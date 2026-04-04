import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { sessions, users, apiKeys } from '../db/schema/index.js';

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
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
    sessionId: string | null;
    impersonator: AuthUser | null;  // the SuperUser doing the impersonating
    isImpersonating: boolean;
  }
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
        request.user = { ...row.user, api_key_scope: null };
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
          request.user = { ...candidate.user, api_key_scope: candidate.apiKey.scope };
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

  // Impersonation hook: runs after auth resolution, allows SuperUsers to act as another user
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    if (request.user && request.user.is_superuser) {
      const impersonateUserId = request.headers['x-impersonate-user'] as string | undefined;
      if (impersonateUserId) {
        const [targetUser] = await db
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
          .where(eq(users.id, impersonateUserId))
          .limit(1);

        if (targetUser && targetUser.is_active) {
          request.impersonator = request.user;
          request.user = { ...targetUser, api_key_scope: null };
          request.isImpersonating = true;
        }
      }
    }
  });

  // Add response headers when impersonating
  fastify.addHook('onSend', async (request, reply) => {
    if (request.isImpersonating) {
      reply.header('X-Impersonating', request.user!.id);
      reply.header('X-Impersonator', request.impersonator!.id);
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

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

const SCOPE_HIERARCHY: Record<string, number> = {
  admin: 3,
  read_write: 2,
  read: 1,
};

export function requireSuperUser() {
  return async function checkSuperUser(request: FastifyRequest, reply: FastifyReply) {
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
  };
}

export function requireMinRole(minRole: string) {
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
    if (request.user.is_superuser) return;
    const userLevel = ROLE_HIERARCHY[request.user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
    if (userLevel < requiredLevel) {
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

export function requireScope(minScope: string) {
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
    // Session auth (no API key) bypasses scope check
    if (request.user.api_key_scope === null) return;
    // SuperUsers bypass scope check
    if (request.user.is_superuser) return;
    const scopeLevel = SCOPE_HIERARCHY[request.user.api_key_scope] ?? 0;
    const requiredLevel = SCOPE_HIERARCHY[minScope] ?? 0;
    if (scopeLevel < requiredLevel) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `API key requires at least '${minScope}' scope`,
          details: [],
          request_id: request.id,
        },
      });
    }
  };
}
