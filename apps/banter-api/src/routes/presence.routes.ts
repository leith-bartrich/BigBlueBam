import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireChannelMember } from '../middleware/channel-auth.js';
import {
  PRESENCE_STATUSES,
  broadcastPresenceChange,
  getPresence,
  listChannelPresence,
  upsertPresence,
} from '../services/presence.service.js';

const presenceUpdateSchema = z.object({
  status: z.enum(['online', 'idle', 'in_call', 'dnd', 'offline']).optional(),
  in_call_channel_id: z.string().uuid().nullable().optional(),
  custom_status_text: z.string().max(200).nullable().optional(),
  custom_status_emoji: z.string().max(10).nullable().optional(),
});

export default async function presenceRoutes(fastify: FastifyInstance) {
  // GET /v1/me/presence — return the current user's presence row.
  fastify.get(
    '/v1/me/presence',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const row = await getPresence(user.id);
      return reply.send({ data: row });
    },
  );

  // POST /v1/me/presence — upsert presence for the current user. Honors
  // partial updates — any field omitted is left unchanged.
  fastify.post(
    '/v1/me/presence',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const user = request.user!;
      const body = presenceUpdateSchema.parse(request.body ?? {});

      // If nothing was provided, default to a simple 'online' heartbeat.
      const effective = {
        user_id: user.id,
        ...body,
        status: body.status ?? ('online' as const),
      };

      if (!PRESENCE_STATUSES.includes(effective.status)) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid presence status',
            details: [
              { field: 'status', issue: `must be one of ${PRESENCE_STATUSES.join(', ')}` },
            ],
            request_id: request.id,
          },
        });
      }

      const row = await upsertPresence(effective);
      broadcastPresenceChange(user.org_id, row);
      return reply.send({ data: row });
    },
  );

  // GET /v1/channels/:id/presence — list non-offline members of a channel.
  fastify.get(
    '/v1/channels/:id/presence',
    { preHandler: [requireAuth, requireChannelMember] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const rows = await listChannelPresence(id);
      return reply.send({ data: rows });
    },
  );
}
