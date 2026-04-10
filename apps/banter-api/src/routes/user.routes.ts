import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { requireAuth } from '../plugins/auth.js';
import { escapeLike } from '../lib/escape-like.js';

/**
 * User resolver routes for Banter.
 *
 * Banter does not own a user directory — users are the shared Bam user
 * records. These read-only endpoints provide "resolver" lookups so callers
 * (especially MCP clients) can translate a human-friendly identifier
 * (email, handle, display_name fragment) into a stable user id without
 * needing to scrape a list endpoint.
 *
 * All endpoints are scoped to the authenticated user's active org via
 * users.org_id (consistent with existing banter routes in dm.routes.ts
 * and channel.routes.ts).
 *
 * Note: the users table has no dedicated handle column. For
 * `/v1/users/by-handle/:handle` we synthesize a handle from
 * lower(display_name) with whitespace collapsed to hyphens, and match
 * against that. Callers can still pass @alice; the leading @ must be
 * stripped by the caller (MCP tool does this).
 */

const listUsersQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(20),
});

function shapeUser(row: {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}) {
  return {
    id: row.id,
    email: row.email,
    // `name` is surfaced as an alias of display_name so the resolver
    // response matches the shape documented for the MCP tool contract.
    name: row.display_name,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
  };
}

export default async function userRoutes(fastify: FastifyInstance) {
  // GET /v1/users/by-email?email=... — case-insensitive exact email lookup
  fastify.get(
    '/v1/users/by-email',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const parsed = z
        .object({ email: z.string().trim().min(1).max(320) })
        .safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'email query parameter is required',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              issue: i.message,
            })),
            request_id: request.id,
          },
        });
      }

      const needle = parsed.data.email.toLowerCase();

      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          display_name: users.display_name,
          avatar_url: users.avatar_url,
        })
        .from(users)
        .where(
          and(
            eq(users.org_id, user.org_id),
            eq(users.is_active, true),
            sql`lower(${users.email}) = ${needle}`,
          ),
        )
        .limit(1);

      return reply.send({ data: row ? shapeUser(row) : null });
    },
  );

  // GET /v1/users/by-handle/:handle — synthesized handle lookup
  // Banter users don't have a handle column. We match a slugified form
  // of display_name: lower(display_name) with whitespace collapsed to '-'
  // and non-alnum/hyphen chars stripped. The caller must have already
  // stripped a leading '@'.
  fastify.get(
    '/v1/users/by-handle/:handle',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const { handle } = request.params as { handle: string };
      if (!handle || handle.length === 0 || handle.length > 100) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'handle path parameter is required',
            details: [],
            request_id: request.id,
          },
        });
      }

      const needle = handle.toLowerCase();

      // Slugify display_name inside SQL so we can match it exactly.
      // regexp_replace: whitespace → '-', then strip anything not [a-z0-9-].
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          display_name: users.display_name,
          avatar_url: users.avatar_url,
        })
        .from(users)
        .where(
          and(
            eq(users.org_id, user.org_id),
            eq(users.is_active, true),
            sql`regexp_replace(regexp_replace(lower(${users.display_name}), '\\s+', '-', 'g'), '[^a-z0-9-]', '', 'g') = ${needle}`,
          ),
        )
        .limit(1);

      return reply.send({ data: row ? shapeUser(row) : null });
    },
  );

  // GET /v1/users/search?q=... — fuzzy search across name / display_name / email
  // No q → most recently active 20 users in the org.
  fastify.get(
    '/v1/users/search',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const parsed = listUsersQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              issue: i.message,
            })),
            request_id: request.id,
          },
        });
      }
      const { q, limit } = parsed.data;

      const baseWhere = and(
        eq(users.org_id, user.org_id),
        eq(users.is_active, true),
      );

      if (!q) {
        // No query: return the most recent 20 users (by created_at desc,
        // falling back on display_name for stable ordering).
        const rows = await db
          .select({
            id: users.id,
            email: users.email,
            display_name: users.display_name,
            avatar_url: users.avatar_url,
          })
          .from(users)
          .where(baseWhere)
          .orderBy(desc(users.created_at), users.display_name)
          .limit(limit);

        return reply.send({ data: rows.map(shapeUser) });
      }

      const pattern = `%${escapeLike(q)}%`;
      const needle = q.toLowerCase();

      // Rank: exact email match > exact display_name match > prefix match > substring.
      // Keep the SQL portable — PostgreSQL only, using a CASE expression.
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          display_name: users.display_name,
          avatar_url: users.avatar_url,
          relevance: sql<number>`
            CASE
              WHEN lower(${users.email}) = ${needle} THEN 0
              WHEN lower(${users.display_name}) = ${needle} THEN 1
              WHEN lower(${users.display_name}) LIKE ${`${needle}%`} THEN 2
              WHEN lower(${users.email}) LIKE ${`${needle}%`} THEN 3
              ELSE 4
            END
          `.as('relevance'),
        })
        .from(users)
        .where(
          and(
            baseWhere,
            or(
              sql`lower(${users.display_name}) LIKE lower(${pattern}) ESCAPE '\\'`,
              sql`lower(${users.email}) LIKE lower(${pattern}) ESCAPE '\\'`,
            ),
          ),
        )
        .orderBy(sql`relevance`, users.display_name)
        .limit(limit);

      return reply.send({ data: rows.map(shapeUser) });
    },
  );
}
