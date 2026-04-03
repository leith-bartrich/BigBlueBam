import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, gt } from 'drizzle-orm';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { sessions } from '../db/schema/sessions.js';
import { users } from '../db/schema/users.js';
import { apiKeys } from '../db/schema/api-keys.js';

export interface AuthUser {
  id: string;
  org_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  timezone: string;
  is_active: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
    sessionId: string | null;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('sessionId', null);

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
          },
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.user_id, users.id))
        .where(eq(sessions.id, sessionId))
        .limit(1);

      const row = result[0];
      if (row && new Date(row.session.expires_at) > new Date() && row.user.is_active) {
        request.user = row.user;
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
          request.user = candidate.user;
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
