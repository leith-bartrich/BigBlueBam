// §13 Wave 4 scheduled banter — scheduled-message management endpoints.
//
// GET  /v1/channels/:id/scheduled-messages   list pending scheduled posts
// DELETE /v1/scheduled-messages/:id           cancel a pending scheduled post
//
// Cancel only transitions status from 'pending' to 'cancelled'. The worker
// checks status at fire time and no-ops if the row has been cancelled.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { banterChannels, banterScheduledMessages } from '../db/schema/index.js';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireChannelMember } from '../middleware/channel-auth.js';

const statusQuerySchema = z.object({
  status: z.enum(['pending', 'delivered', 'cancelled', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export default async function scheduledMessagesRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/v1/channels/:id/scheduled-messages',
    { preHandler: [requireAuth, requireChannelMember] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const query = statusQuerySchema.parse(request.query ?? {});
      const limit = query.limit ?? 50;
      const status = query.status ?? 'pending';

      const rows = await db
        .select()
        .from(banterScheduledMessages)
        .where(
          and(
            eq(banterScheduledMessages.channel_id, id),
            eq(banterScheduledMessages.org_id, user.org_id),
            eq(banterScheduledMessages.status, status),
          ),
        )
        .orderBy(desc(banterScheduledMessages.scheduled_at))
        .limit(limit);

      return reply.send({ data: rows });
    },
  );

  fastify.delete(
    '/v1/scheduled-messages/:id',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      // Scope cancel to rows the caller can see: same org, and either the
      // original author OR an org owner/admin/superuser for moderation.
      const [row] = await db
        .select({
          scheduled: banterScheduledMessages,
          channel_org: banterChannels.org_id,
        })
        .from(banterScheduledMessages)
        .innerJoin(
          banterChannels,
          eq(banterChannels.id, banterScheduledMessages.channel_id),
        )
        .where(
          and(
            eq(banterScheduledMessages.id, id),
            eq(banterScheduledMessages.org_id, user.org_id),
          ),
        )
        .limit(1);

      if (!row) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Scheduled message not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      const isOrgStaff =
        user.is_superuser || ['owner', 'admin'].includes(user.role);
      if (row.scheduled.author_id !== user.id && !isOrgStaff) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot cancel another user\'s scheduled message',
            details: [],
            request_id: request.id,
          },
        });
      }

      if (row.scheduled.status !== 'pending') {
        return reply.status(409).send({
          error: {
            code: 'INVALID_STATE',
            message: `Cannot cancel a message that is '${row.scheduled.status}'`,
            details: [],
            request_id: request.id,
          },
        });
      }

      const [updated] = await db
        .update(banterScheduledMessages)
        .set({ status: 'cancelled', cancelled_at: new Date() })
        .where(eq(banterScheduledMessages.id, id))
        .returning();

      return reply.send({ data: updated });
    },
  );
}
