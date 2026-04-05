import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  banterBookmarks,
  banterMessages,
  banterChannels,
  banterChannelMemberships,
  users,
} from '../db/schema/index.js';
import { requireAuth, requireScope } from '../plugins/auth.js';

const createBookmarkSchema = z.object({
  message_id: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export default async function bookmarkRoutes(fastify: FastifyInstance) {
  // GET /v1/bookmarks — list user's bookmarks
  fastify.get(
    '/v1/bookmarks',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;

      const bookmarks = await db
        .select({
          bookmark: banterBookmarks,
          message: banterMessages,
          author: {
            id: users.id,
            display_name: users.display_name,
            avatar_url: users.avatar_url,
          },
        })
        .from(banterBookmarks)
        .innerJoin(banterMessages, eq(banterBookmarks.message_id, banterMessages.id))
        .innerJoin(users, eq(banterMessages.author_id, users.id))
        .where(eq(banterBookmarks.user_id, user.id))
        .orderBy(banterBookmarks.created_at);

      const data = bookmarks.map((row) => ({
        ...row.bookmark,
        message: {
          ...row.message,
          author: row.author,
        },
      }));

      return reply.send({ data });
    },
  );

  // POST /v1/bookmarks — create bookmark
  fastify.post(
    '/v1/bookmarks',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const user = request.user!;
      const body = createBookmarkSchema.parse(request.body);

      // Verify message exists
      const [message] = await db
        .select()
        .from(banterMessages)
        .where(and(eq(banterMessages.id, body.message_id), eq(banterMessages.is_deleted, false)))
        .limit(1);

      if (!message) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Message not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Verify user is a member of the message's channel
      const [channel] = await db
        .select()
        .from(banterChannels)
        .where(eq(banterChannels.id, message.channel_id))
        .limit(1);

      const [channelMembership] = await db
        .select()
        .from(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, message.channel_id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        )
        .limit(1);

      if (!channelMembership) {
        const isDm = channel && (channel.type === 'dm' || channel.type === 'group_dm');
        const hasOrgOverride =
          !isDm &&
          channel &&
          channel.org_id === user.org_id &&
          (user.is_superuser || ['owner', 'admin'].includes(user.role));

        if (!hasOrgOverride) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Message not found',
              details: [],
              request_id: request.id,
            },
          });
        }
      }

      const [bookmark] = await db
        .insert(banterBookmarks)
        .values({
          user_id: user.id,
          message_id: body.message_id,
          note: body.note ?? null,
        })
        .onConflictDoNothing()
        .returning();

      return reply.status(201).send({ data: bookmark ?? { already_bookmarked: true } });
    },
  );

  // DELETE /v1/bookmarks/:id — remove bookmark
  fastify.delete(
    '/v1/bookmarks/:id',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      await db
        .delete(banterBookmarks)
        .where(
          and(
            eq(banterBookmarks.id, id),
            eq(banterBookmarks.user_id, user.id),
          ),
        );

      return reply.send({ data: { success: true } });
    },
  );
}
