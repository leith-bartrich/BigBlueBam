import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { sessions } from '../db/schema/sessions.js';
import { users } from '../db/schema/users.js';
import { apiKeys } from '../db/schema/api-keys.js';
import { organizationMemberships } from '../db/schema/organization-memberships.js';

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
  if (typeof header === 'string' && header.length > 0) return header;
  if (Array.isArray(header) && header.length > 0) return header[0];
  return undefined;
}

async function buildAuthUser(
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

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('sessionId', null);
  fastify.decorateRequest('impersonator', null);
  fastify.decorateRequest('isImpersonating', false);

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
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
      if (row && new Date(row.session.expires_at) > new Date() && row.user.is_active) {
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

      for (const candidate of candidates) {
        if (candidate.apiKey.expires_at && new Date(candidate.apiKey.expires_at) < new Date()) {
          continue;
        }
        const valid = await argon2.verify(candidate.apiKey.key_hash, token);
        if (valid && candidate.user.is_active) {
          request.user = await buildAuthUser(candidate.user, candidate.apiKey.scope, request);
          // Update last_used_at
          await db
            .update(apiKeys)
            .set({ last_used_at: new Date() })
            .where(eq(apiKeys.id, candidate.apiKey.id));
          return;
        }
      }
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
