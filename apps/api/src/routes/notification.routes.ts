import type { FastifyInstance } from 'fastify';
import { eq, and, lt, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { notifications } from '../db/schema/notifications.js';
import { requireAuth } from '../plugins/auth.js';

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: {
      cursor?: string;
      limit?: string;
      'filter[is_read]'?: string;
    };
  }>(
    '/me/notifications',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const conditions = [eq(notifications.user_id, request.user!.id)];

      if (request.query['filter[is_read]'] !== undefined) {
        conditions.push(
          eq(notifications.is_read, request.query['filter[is_read]'] === 'true'),
        );
      }

      if (request.query.cursor) {
        conditions.push(lt(notifications.created_at, new Date(request.query.cursor)));
      }

      const result = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.created_at))
        .limit(limit + 1);

      const hasMore = result.length > limit;
      const data = hasMore ? result.slice(0, limit) : result;
      const nextCursor =
        hasMore && data.length > 0
          ? data[data.length - 1]!.created_at.toISOString()
          : null;

      return reply.send({
        data,
        meta: {
          next_cursor: nextCursor,
          has_more: hasMore,
        },
      });
    },
  );

  fastify.post(
    '/me/notifications/mark-read',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const schema = z.union([
        z.object({ notification_ids: z.array(z.string().uuid()) }),
        z.object({ all: z.literal(true) }),
      ]);
      const data = schema.parse(request.body);

      if ('all' in data && data.all) {
        await db
          .update(notifications)
          .set({ is_read: true })
          .where(
            and(
              eq(notifications.user_id, request.user!.id),
              eq(notifications.is_read, false),
            ),
          );
      } else if ('notification_ids' in data) {
        await db
          .update(notifications)
          .set({ is_read: true })
          .where(
            and(
              eq(notifications.user_id, request.user!.id),
              inArray(notifications.id, data.notification_ids),
            ),
          );
      }

      return reply.send({ data: { success: true } });
    },
  );
}
