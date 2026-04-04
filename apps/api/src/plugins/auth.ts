import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, isNull, gt } from 'drizzle-orm';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { sessions } from '../db/schema/sessions.js';
import { users } from '../db/schema/users.js';
import { apiKeys } from '../db/schema/api-keys.js';
import { organizationMemberships } from '../db/schema/organization-memberships.js';
import { impersonationSessions } from '../db/schema/impersonation-sessions.js';

const UUID_REGEX_HEADER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class OrgMembershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgMembershipError';
  }
}

export interface OrgMembership {
  org_id: string;
  role: string;
  is_default: boolean;
}

export interface AuthUser {
  id: string;
  org_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  timezone: string;
  is_active: boolean;
  is_superuser: boolean;
  api_key_scope: string | null;
  org_memberships: OrgMembership[];
  active_org_id: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
    sessionId: string | null;
    impersonator: AuthUser | null;  // the SuperUser doing the impersonating
    isImpersonating: boolean;
  }
}

interface BaseUserRow {
  id: string;
  org_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  timezone: string;
  is_active: boolean;
  is_superuser: boolean;
}

/**
 * Resolves the active organization context for a user.
 *
 * Precedence:
 *   1. X-Org-Id request header (if user is a member of that org)
 *   2. The user's default membership (is_default=true)
 *   3. The user's first membership (by joined_at)
 *   4. Fallback to users.org_id if no memberships exist yet (pre-migration)
 */
async function resolveOrgContext(
  userId: string,
  fallbackOrgId: string,
  fallbackRole: string,
  requestedOrgId: string | undefined,
): Promise<{ memberships: OrgMembership[]; activeOrgId: string; activeRole: string }> {
  const rows = await db
    .select({
      org_id: organizationMemberships.org_id,
      role: organizationMemberships.role,
      is_default: organizationMemberships.is_default,
      joined_at: organizationMemberships.joined_at,
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.user_id, userId));

  if (rows.length === 0) {
    // User hasn't been backfilled yet — fall back to users.org_id/role.
    // If users.org_id is also NULL/empty, the user has no valid org context.
    if (!fallbackOrgId) {
      throw new OrgMembershipError('User has no organization memberships and no fallback org_id');
    }
    return {
      memberships: [
        { org_id: fallbackOrgId, role: fallbackRole, is_default: true },
      ],
      activeOrgId: fallbackOrgId,
      activeRole: fallbackRole,
    };
  }

  // Sort by joined_at ascending so "first membership" is deterministic.
  rows.sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

  const memberships: OrgMembership[] = rows.map((r) => ({
    org_id: r.org_id,
    role: r.role,
    is_default: r.is_default,
  }));

  let active: OrgMembership | undefined;

  if (requestedOrgId) {
    active = memberships.find((m) => m.org_id === requestedOrgId);
    if (!active) {
      throw new OrgMembershipError(
        `User is not a member of the requested organization: ${requestedOrgId}`,
      );
    }
  }
  if (!active) {
    active = memberships.find((m) => m.is_default);
  }
  if (!active) {
    active = memberships[0];
  }

  return {
    memberships,
    activeOrgId: active!.org_id,
    activeRole: active!.role,
  };
}

function getRequestedOrgId(request: FastifyRequest): string | undefined {
  const header = request.headers['x-org-id'];
  let value: string | undefined;
  if (typeof header === 'string' && header.length > 0) value = header;
  else if (Array.isArray(header) && header.length > 0) value = header[0];
  if (!value) return undefined;
  // Validate UUID shape; silently ignore malformed header values.
  if (value.length !== 36 || !UUID_REGEX_HEADER.test(value)) return undefined;
  return value;
}

export async function buildAuthUser(
  row: BaseUserRow,
  apiKeyScope: string | null,
  request: FastifyRequest,
): Promise<AuthUser> {
  const requestedOrgId = getRequestedOrgId(request);
  const { memberships, activeOrgId, activeRole } = await resolveOrgContext(
    row.id,
    row.org_id,
    row.role,
    requestedOrgId,
  );

  return {
    id: row.id,
    org_id: activeOrgId,
    email: row.email,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    role: activeRole,
    timezone: row.timezone,
    is_active: row.is_active,
    is_superuser: row.is_superuser,
    api_key_scope: apiKeyScope,
    org_memberships: memberships,
    active_org_id: activeOrgId,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getImpersonateHeader(request: FastifyRequest): string | undefined {
  const header = request.headers['x-impersonate-user'];
  if (typeof header === 'string' && header.length > 0) return header;
  if (Array.isArray(header) && header.length > 0) return header[0];
  return undefined;
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('sessionId', null);
  fastify.decorateRequest('impersonator', null);
  fastify.decorateRequest('isImpersonating', false);

  // P1-19: is_active is checked at this auth preHandler on every request
  // (the JOIN fetches users.is_active fresh each time). Long-running handlers
  // may continue with stale is_active=true if a user is deactivated after
  // this check passes. For typical request durations (<100ms) the window is
  // negligible; we accept this trade-off rather than re-querying mid-handler.
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
    // Try session cookie first
    const sessionId = request.cookies?.session;
    if (sessionId) {
      const result = await db
        .select({
          session: sessions,
          user: {
            id: users.id,
            org_id: users.org_id,
            email: users.email,
            display_name: users.display_name,
            avatar_url: users.avatar_url,
            role: users.role,
            timezone: users.timezone,
            is_active: users.is_active,
            is_superuser: users.is_superuser,
          },
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.user_id, users.id))
        .where(eq(sessions.id, sessionId))
        .limit(1);

      const row = result[0];
      if (row && new Date(row.session.expires_at).getTime() + 30_000 > Date.now() && row.user.is_active) {
        request.user = await buildAuthUser(row.user, null, request);
        request.sessionId = sessionId;
        return;
      }
    }

    // Try Bearer token (API key)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const prefix = token.slice(0, 8);

      const candidates = await db
        .select({
          apiKey: apiKeys,
          user: {
            id: users.id,
            org_id: users.org_id,
            email: users.email,
            display_name: users.display_name,
            avatar_url: users.avatar_url,
            role: users.role,
            timezone: users.timezone,
            is_active: users.is_active,
            is_superuser: users.is_superuser,
          },
        })
        .from(apiKeys)
        .innerJoin(users, eq(apiKeys.user_id, users.id))
        .where(eq(apiKeys.key_prefix, prefix))
        .limit(10);

      // P2-11: An 8-char random prefix has ~2.8 x 10^14 combinations, so
      // natural collisions are vanishingly rare. Combined with the
      // candidate cap below, the 8-char prefix is sufficient — we will
      // never verify more than a handful of Argon2 hashes per request.
      //
      // DoS mitigation: seeing >3 candidates for a single prefix is a
      // strong signal of an attacker trying to force multiple Argon2
      // verifications per request. In that case, log a warning and only
      // verify the first candidate.
      const verifyCandidates = candidates.length > 3 ? candidates.slice(0, 1) : candidates;
      if (candidates.length > 3) {
        request.log.warn(
          { prefix, candidate_count: candidates.length },
          'Suspicious number of API key candidates for prefix; limiting to first candidate',
        );
      }

      for (const candidate of verifyCandidates) {
        // P2-10: Always run argon2.verify BEFORE checking expiry so that
        // expired-but-valid-hash keys and invalid-hash keys take the same
        // amount of wall time. Short-circuiting on expiry first would leak
        // (via timing) whether a given prefix corresponds to a real key.
        const valid = await argon2.verify(candidate.apiKey.key_hash, token);
        if (candidate.apiKey.expires_at && new Date(candidate.apiKey.expires_at) < new Date()) {
          continue;
        }
        if (valid && candidate.user.is_active) {
          request.user = await buildAuthUser(candidate.user, candidate.apiKey.scope, request);
          // Update last_used_at — fire-and-forget, log errors but don't block the response.
          db.update(apiKeys)
            .set({ last_used_at: new Date() })
            .where(eq(apiKeys.id, candidate.apiKey.id))
            .catch((err) => {
              console.warn('Failed to update api_keys.last_used_at:', err);
            });
          return;
        }
      }
    }
    } catch (err) {
      if (err instanceof OrgMembershipError) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: err.message,
            details: [],
            request_id: request.id,
          },
        });
      }
      throw err;
    }
  });

  // Impersonation hook: runs AFTER main auth, only SuperUsers can impersonate
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const impersonateHeader = getImpersonateHeader(request);
    if (!impersonateHeader) return;
    // Silently ignore if not a superuser
    if (!request.user || request.user.is_superuser !== true) return;
    // Validate UUID shape
    if (typeof impersonateHeader !== 'string' || impersonateHeader.length !== 36) return;
    if (!UUID_REGEX.test(impersonateHeader)) return;
    // No-op on self-impersonation
    if (impersonateHeader === request.user.id) return;

    const result = await db
      .select({
        id: users.id,
        org_id: users.org_id,
        email: users.email,
        display_name: users.display_name,
        avatar_url: users.avatar_url,
        role: users.role,
        timezone: users.timezone,
        is_active: users.is_active,
        is_superuser: users.is_superuser,
      })
      .from(users)
      .where(eq(users.id, impersonateHeader))
      .limit(1);

    const target = result[0];
    if (!target) return;
    if (!target.is_active) return;
    if (target.is_superuser) return; // prevent SU impersonation chaining

    // Require an active (non-expired, non-ended) impersonation session
    // created via POST /v1/platform/impersonate.
    const now = new Date();
    const activeSession = await db
      .select({ id: impersonationSessions.id })
      .from(impersonationSessions)
      .where(
        and(
          eq(impersonationSessions.superuser_id, request.user.id),
          eq(impersonationSessions.target_user_id, target.id),
          isNull(impersonationSessions.ended_at),
          gt(impersonationSessions.expires_at, now),
        ),
      )
      .limit(1);

    if (activeSession.length === 0) return;

    request.impersonator = request.user;
    request.user = await buildAuthUser(target, null, request);
    request.isImpersonating = true;
  });

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.isImpersonating && request.impersonator) {
      reply.header('X-Impersonating', 'true');
      reply.header('X-Impersonator', request.impersonator.id);
    }
  });
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['@fastify/cookie'],
});

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        details: [],
        request_id: request.id,
      },
    });
  }
}

/** Requires the user to be a SuperUser */
export async function requireSuperUser(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        details: [],
        request_id: request.id,
      },
    });
  }
  if (!request.user.is_superuser) {
    return reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'SuperUser access required',
        details: [],
        request_id: request.id,
      },
    });
  }
}

/** Requires the user's role to be at or above the minimum level.
 *  Hierarchy: owner > admin > member > viewer
 *  SuperUsers always pass. */
export function requireMinRole(minRole: 'viewer' | 'member' | 'admin' | 'owner') {
  const hierarchy = ['viewer', 'member', 'admin', 'owner'];
  const minLevel = hierarchy.indexOf(minRole);

  return async function checkMinRole(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: [],
          request_id: request.id,
        },
      });
    }
    if (request.user.is_superuser) return; // SuperUsers bypass role checks

    const userLevel = hierarchy.indexOf(request.user.role);
    if (userLevel < minLevel) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Requires at least ${minRole} role`,
          details: [],
          request_id: request.id,
        },
      });
    }
  };
}

/** Requires the API key scope to allow the given operation type.
 *  Hierarchy: admin > read_write > read
 *  Session auth (no API key) always passes.
 *  SuperUsers always pass. */
export function requireScope(minScope: 'read' | 'read_write' | 'admin') {
  const scopeHierarchy = ['read', 'read_write', 'admin'];
  const minLevel = scopeHierarchy.indexOf(minScope);

  // Known limitation (P1-23): Scope is cached at auth time; revoked keys
  // remain valid until request completes. Re-querying on every scope check
  // would add a DB round-trip to every authorized call — the window is
  // bounded by request duration so we accept this trade-off.
  return async function checkScope(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: [],
          request_id: request.id,
        },
      });
    }
    if (request.user.is_superuser) return;
    if (request.user.api_key_scope === null) return; // Session auth, no scope restriction

    const userScopeLevel = scopeHierarchy.indexOf(request.user.api_key_scope);
    if (userScopeLevel < minLevel) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `API key requires '${minScope}' scope or higher`,
          details: [],
          request_id: request.id,
        },
      });
    }
  };
}

export function requireRole(roles: string[]) {
  return async function checkRole(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: [],
          request_id: request.id,
        },
      });
    }
    if (request.user.is_superuser) return;
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of roles: ${roles.join(', ')}`,
          details: [],
          request_id: request.id,
        },
      });
    }
  };
}
