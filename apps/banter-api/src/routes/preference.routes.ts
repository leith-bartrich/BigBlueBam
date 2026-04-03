import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  banterUserPreferences,
  banterChannelMemberships,
  banterChannels,
  banterMessages,
} from '../db/schema/index.js';
import { requireAuth } from '../plugins/auth.js';
import { broadcastToOrg } from '../services/realtime.js';

const updatePreferencesSchema = z.object({
  default_notification_level: z.enum(['all', 'mentions', 'none']).optional(),
  sidebar_sort: z.enum(['recent', 'alpha', 'custom']).optional(),
  sidebar_collapsed_groups: z.array(z.string().uuid()).optional(),
  theme_override: z.string().max(20).nullable().optional(),
  enter_sends_message: z.boolean().optional(),
  show_message_timestamps: z.enum(['hover', 'always', 'never']).optional(),
  compact_mode: z.boolean().optional(),
  auto_join_huddles: z.boolean().optional(),
  noise_suppression: z.boolean().optional(),
});

const presenceSchema = z.object({
  status: z.enum(['online', 'idle', 'dnd']),
});

export default async function preferenceRoutes(fastify: FastifyInstance) {
  // GET /v1/me/preferences
  fastify.get(
    '/v1/me/preferences',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;

      const [prefs] = await db
        .select()
        .from(banterUserPreferences)
        .where(eq(banterUserPreferences.user_id, user.id))
        .limit(1);

      if (!prefs) {
        // Return defaults
        return reply.send({
          data: {
            user_id: user.id,
            default_notification_level: 'mentions',
            sidebar_sort: 'recent',
            sidebar_collapsed_groups: [],
            theme_override: null,
            enter_sends_message: true,
            show_message_timestamps: 'hover',
            compact_mode: false,
            auto_join_huddles: false,
            noise_suppression: true,
          },
        });
      }

      return reply.send({ data: prefs });
    },
  );

  // PATCH /v1/me/preferences
  fastify.patch(
    '/v1/me/preferences',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const body = updatePreferencesSchema.parse(request.body);

      // Upsert preferences
      const [existing] = await db
        .select()
        .from(banterUserPreferences)
        .where(eq(banterUserPreferences.user_id, user.id))
        .limit(1);

      let prefs;
      if (existing) {
        [prefs] = await db
          .update(banterUserPreferences)
          .set(body)
          .where(eq(banterUserPreferences.user_id, user.id))
          .returning();
      } else {
        [prefs] = await db
          .insert(banterUserPreferences)
          .values({
            user_id: user.id,
            ...body,
          })
          .returning();
      }

      return reply.send({ data: prefs });
    },
  );

  // POST /v1/me/presence — set presence status
  fastify.post(
    '/v1/me/presence',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const body = presenceSchema.parse(request.body);

      // Store presence in Redis with TTL
      await fastify.redis.setex(
        `banter:presence:${user.id}`,
        300, // 5 minutes TTL
        body.status,
      );

      broadcastToOrg(user.org_id, {
        type: 'presence.changed',
        data: {
          user_id: user.id,
          status: body.status,
        },
        timestamp: new Date().toISOString(),
      });

      return reply.send({ data: { user_id: user.id, status: body.status } });
    },
  );

  // GET /v1/me/unread — summary of unread counts per channel
  fastify.get(
    '/v1/me/unread',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;

      const memberships = await db
        .select({
          channel_id: banterChannelMemberships.channel_id,
          last_read_message_id: banterChannelMemberships.last_read_message_id,
        })
        .from(banterChannelMemberships)
        .innerJoin(
          banterChannels,
          and(
            eq(banterChannelMemberships.channel_id, banterChannels.id),
            eq(banterChannels.is_archived, false),
          ),
        )
        .where(eq(banterChannelMemberships.user_id, user.id));

      const unreadSummary = await Promise.all(
        memberships.map(async (m) => {
          let count = 0;
          if (m.last_read_message_id) {
            const result = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(banterMessages)
              .where(
                and(
                  eq(banterMessages.channel_id, m.channel_id),
                  eq(banterMessages.is_deleted, false),
                  isNull(banterMessages.thread_parent_id),
                  sql`${banterMessages.created_at} > (SELECT created_at FROM banter_messages WHERE id = ${m.last_read_message_id})`,
                ),
              );
            count = result[0]?.count ?? 0;
          } else {
            const result = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(banterMessages)
              .where(
                and(
                  eq(banterMessages.channel_id, m.channel_id),
                  eq(banterMessages.is_deleted, false),
                  isNull(banterMessages.thread_parent_id),
                ),
              );
            count = result[0]?.count ?? 0;
          }
          return { channel_id: m.channel_id, unread_count: count };
        }),
      );

      const total = unreadSummary.reduce((sum, s) => sum + s.unread_count, 0);

      return reply.send({
        data: {
          total_unread: total,
          channels: unreadSummary.filter((s) => s.unread_count > 0),
        },
      });
    },
  );
}
