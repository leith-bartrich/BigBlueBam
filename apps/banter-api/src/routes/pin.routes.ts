import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  banterChannels,
  banterChannelMemberships,
  banterMessages,
  banterPins,
  users,
} from '../db/schema/index.js';
import { requireAuth } from '../plugins/auth.js';
import { broadcastToChannel } from '../services/realtime.js';

const createPinSchema = z.object({
  message_id: z.string().uuid(),
});

export default async function pinRoutes(fastify: FastifyInstance) {
  // GET /v1/channels/:id/pins
  fastify.get(
    '/v1/channels/:id/pins',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const pins = await db
        .select({
          pin: banterPins,
          message: banterMessages,
          author: {
            id: users.id,
            display_name: users.display_name,
            avatar_url: users.avatar_url,
          },
        })
        .from(banterPins)
        .innerJoin(banterMessages, eq(banterPins.message_id, banterMessages.id))
        .innerJoin(users, eq(banterMessages.author_id, users.id))
        .where(eq(banterPins.channel_id, id))
        .orderBy(banterPins.created_at);

      const data = pins.map((row) => ({
        ...row.pin,
        message: {
          ...row.message,
          author: row.author,
        },
      }));

      return reply.send({ data });
    },
  );

  // POST /v1/channels/:id/pins — pin message
  fastify.post(
    '/v1/channels/:id/pins',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const body = createPinSchema.parse(request.body);

      // Verify channel and membership with admin/owner role
      const [membership] = await db
        .select()
        .from(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        )
        .limit(1);

      if (!membership) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Must be a member of this channel',
            details: [],
            request_id: request.id,
          },
        });
      }

      if (
        membership.role === 'member' &&
        !['owner', 'admin'].includes(user.role)
      ) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to pin messages',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Verify message belongs to channel
      const [message] = await db
        .select()
        .from(banterMessages)
        .where(
          and(
            eq(banterMessages.id, body.message_id),
            eq(banterMessages.channel_id, id),
          ),
        )
        .limit(1);

      if (!message) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Message not found in this channel',
            details: [],
            request_id: request.id,
          },
        });
      }

      const [pin] = await db
        .insert(banterPins)
        .values({
          channel_id: id,
          message_id: body.message_id,
          pinned_by: user.id,
        })
        .onConflictDoNothing()
        .returning();

      if (pin) {
        broadcastToChannel(id, {
          type: 'pin.added',
          data: { pin, channel_id: id, message_id: body.message_id },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(201).send({ data: pin ?? { already_pinned: true } });
    },
  );

  // DELETE /v1/channels/:id/pins/:messageId — unpin
  fastify.delete(
    '/v1/channels/:id/pins/:messageId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id, messageId } = request.params as { id: string; messageId: string };
      const user = request.user!;

      // Verify membership with admin/owner role
      const [membership] = await db
        .select()
        .from(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        )
        .limit(1);

      if (
        !membership ||
        (membership.role === 'member' && !['owner', 'admin'].includes(user.role))
      ) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to unpin messages',
            details: [],
            request_id: request.id,
          },
        });
      }

      const deleted = await db
        .delete(banterPins)
        .where(
          and(
            eq(banterPins.channel_id, id),
            eq(banterPins.message_id, messageId),
          ),
        )
        .returning();

      if (deleted.length > 0) {
        broadcastToChannel(id, {
          type: 'pin.removed',
          data: { channel_id: id, message_id: messageId },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ data: { success: true } });
    },
  );
}
