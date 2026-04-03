import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, sql, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  banterMessages,
  banterChannels,
  banterChannelMemberships,
  users,
} from '../db/schema/index.js';
import { requireAuth } from '../plugins/auth.js';

const searchMessagesSchema = z.object({
  q: z.string().min(1).max(500),
  channel_id: z.string().uuid().optional(),
  author_id: z.string().uuid().optional(),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
  has_attachments: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const searchChannelsSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export default async function searchRoutes(fastify: FastifyInstance) {
  // GET /v1/search/messages — full-text search using PostgreSQL tsvector
  fastify.get(
    '/v1/search/messages',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const params = searchMessagesSchema.parse(request.query);

      // Build dynamic WHERE conditions
      const conditions: ReturnType<typeof sql>[] = [];

      // User must be member of the channel
      conditions.push(
        sql`${banterMessages.channel_id} IN (
          SELECT ${banterChannelMemberships.channel_id}
          FROM ${banterChannelMemberships}
          WHERE ${banterChannelMemberships.user_id} = ${user.id}
        )`,
      );

      // Channel must belong to org
      conditions.push(
        sql`${banterMessages.channel_id} IN (
          SELECT ${banterChannels.id}
          FROM ${banterChannels}
          WHERE ${banterChannels.org_id} = ${user.org_id}
        )`,
      );

      // Not deleted
      conditions.push(sql`${banterMessages.is_deleted} = false`);

      // Full-text search using PostgreSQL to_tsvector / plainto_tsquery
      conditions.push(
        sql`to_tsvector('english', ${banterMessages.content_plain}) @@ plainto_tsquery('english', ${params.q})`,
      );

      // Optional filters
      if (params.channel_id) {
        conditions.push(sql`${banterMessages.channel_id} = ${params.channel_id}`);
      }
      if (params.author_id) {
        conditions.push(sql`${banterMessages.author_id} = ${params.author_id}`);
      }
      if (params.before) {
        conditions.push(sql`${banterMessages.created_at} < ${params.before}`);
      }
      if (params.after) {
        conditions.push(sql`${banterMessages.created_at} > ${params.after}`);
      }
      if (params.has_attachments !== undefined) {
        if (params.has_attachments) {
          conditions.push(sql`${banterMessages.attachment_count} > 0`);
        } else {
          conditions.push(sql`${banterMessages.attachment_count} = 0`);
        }
      }

      const whereClause = sql.join(conditions, sql` AND `);

      // Query with ts_headline for highlighted snippets
      const results = await db.execute(sql`
        SELECT
          m.id,
          m.channel_id,
          m.author_id,
          m.thread_parent_id,
          m.created_at,
          m.attachment_count,
          ts_headline(
            'english',
            m.content_plain,
            plainto_tsquery('english', ${params.q}),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
          ) AS snippet,
          c.name AS channel_name,
          c.slug AS channel_slug,
          u.display_name AS author_name,
          u.avatar_url AS author_avatar_url,
          ts_rank(
            to_tsvector('english', m.content_plain),
            plainto_tsquery('english', ${params.q})
          ) AS rank
        FROM banter_messages m
        INNER JOIN banter_channels c ON c.id = m.channel_id
        INNER JOIN users u ON u.id = m.author_id
        WHERE ${whereClause}
        ORDER BY rank DESC, m.created_at DESC
        LIMIT ${params.limit}
        OFFSET ${params.offset}
      `);

      // Get total count
      const countResult = await db.execute(sql`
        SELECT count(*)::int AS total
        FROM banter_messages m
        WHERE ${whereClause}
      `);

      const total = (countResult[0] as any)?.total ?? 0;

      return reply.send({
        data: results,
        pagination: {
          total,
          limit: params.limit,
          offset: params.offset,
        },
      });
    },
  );

  // GET /v1/search/channels — search by name/topic
  fastify.get(
    '/v1/search/channels',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const params = searchChannelsSchema.parse(request.query);

      const searchPattern = `%${params.q}%`;

      const channels = await db
        .select()
        .from(banterChannels)
        .where(
          and(
            eq(banterChannels.org_id, user.org_id),
            eq(banterChannels.is_archived, false),
            sql`(
              ${banterChannels.name} ILIKE ${searchPattern}
              OR ${banterChannels.display_name} ILIKE ${searchPattern}
              OR ${banterChannels.topic} ILIKE ${searchPattern}
              OR ${banterChannels.description} ILIKE ${searchPattern}
            )`,
          ),
        )
        .orderBy(banterChannels.name)
        .limit(params.limit)
        .offset(params.offset);

      return reply.send({ data: channels });
    },
  );
}
