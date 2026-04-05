import type { FastifyInstance } from 'fastify';
import {
  findUserByVerificationToken,
  completeEmailVerification,
  deleteAllUserSessions,
} from '../services/superuser-users.service.js';

const VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default async function emailVerifyRoutes(fastify: FastifyInstance) {
  // ─── POST /auth/verify-email/:token ───────────────────────────────────────
  // Public endpoint. No auth required. Given a verification token issued
  // during an email-change flow, finalize the swap: promote pending_email
  // to email, clear the token, mark email_verified=true, and invalidate
  // all existing sessions (the user must log in with the new address).
  fastify.post<{ Params: { token: string } }>(
    '/auth/verify-email/:token',
    async (request, reply) => {
      const { token } = request.params;

      if (!token || typeof token !== 'string' || token.length < 16) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Verification token not found or expired',
            details: [],
            request_id: request.id,
          },
        });
      }

      const user = await findUserByVerificationToken(token);

      if (!user || !user.pending_email) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Verification token not found or expired',
            details: [],
            request_id: request.id,
          },
        });
      }

      // TTL check
      if (user.email_verification_sent_at) {
        const sentAtMs = user.email_verification_sent_at.getTime();
        if (Date.now() - sentAtMs > VERIFICATION_TTL_MS) {
          return reply.status(410).send({
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Verification token has expired',
              details: [],
              request_id: request.id,
            },
          });
        }
      }

      const newEmail = user.pending_email;

      await completeEmailVerification(user.id, newEmail);
      // Invalidate all sessions for safety.
      await deleteAllUserSessions(user.id);

      return reply.send({
        data: {
          email: newEmail,
          verified: true,
        },
      });
    },
  );
}
