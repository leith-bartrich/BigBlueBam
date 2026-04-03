import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { helpdeskSessions } from '../db/schema/helpdesk-sessions.js';
import { helpdeskUsers } from '../db/schema/helpdesk-users.js';

export interface HelpdeskUser {
  id: string;
  email: string;
  display_name: string;
  email_verified: boolean;
  is_active: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    helpdeskUser: HelpdeskUser | null;
    helpdeskSessionId: string | null;
  }
}

async function helpdeskAuthPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('helpdeskUser', null);
  fastify.decorateRequest('helpdeskSessionId', null);

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const sessionId = request.cookies?.helpdesk_session;
    if (!sessionId) return;

    const result = await db
      .select({
        session: helpdeskSessions,
        user: {
          id: helpdeskUsers.id,
          email: helpdeskUsers.email,
          display_name: helpdeskUsers.display_name,
          email_verified: helpdeskUsers.email_verified,
          is_active: helpdeskUsers.is_active,
        },
      })
      .from(helpdeskSessions)
      .innerJoin(helpdeskUsers, eq(helpdeskSessions.user_id, helpdeskUsers.id))
      .where(eq(helpdeskSessions.id, sessionId))
      .limit(1);

    const row = result[0];
    if (row && new Date(row.session.expires_at) > new Date() && row.user.is_active) {
      request.helpdeskUser = row.user;
      request.helpdeskSessionId = sessionId;
    }
  });
}

export default fp(helpdeskAuthPlugin, {
  name: 'helpdesk-auth',
  dependencies: ['@fastify/cookie'],
});

export async function requireHelpdeskAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.helpdeskUser) {
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
