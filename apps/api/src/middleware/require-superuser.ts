import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Fastify preHandler that asserts the authenticated user has
 * `is_superuser === true`. Responds:
 *   - 401 UNAUTHORIZED if no authenticated user/session
 *   - 403 FORBIDDEN   if the user is not a superuser
 *
 * Intended to guard `/superuser/*` routes. Must run AFTER the auth plugin
 * (which populates `request.user` and `request.sessionId`).
 */
export async function requireSuperuser(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.user || !request.sessionId) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        details: [],
        request_id: request.id,
      },
    });
  }

  if (request.user.is_superuser !== true) {
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
