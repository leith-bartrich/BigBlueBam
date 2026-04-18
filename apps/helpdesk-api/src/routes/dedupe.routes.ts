import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema/bbb-refs.js';
import { verifyAgentApiKey, requireAgentAuth } from '../lib/agent-auth.js';
import * as similarTicketsService from '../services/similar-tickets.service.js';

/**
 * Helpdesk dedupe routes (Wave 5 AGENTIC_TODO §7).
 *
 *   GET /helpdesk/agents/tickets/:id/similar
 *
 * Returns ranked similar tickets for a given ticket using pg_trgm
 * similarity on subject plus requester / category / linked-duplicate
 * boosts. Each candidate carries the contributing signals and, when
 * present, the prior decision row from dedupe_decisions keyed by the
 * canonical ordered pair so callers can suppress already-resolved
 * pairs. Org-scoping matches the rest of the agent surface: the
 * caller's org is resolved from the Bam session cookie or the agent
 * API key, and results are always filtered to that org via
 * projects.org_id.
 */

const querySchema = z.object({
  status_filter: z.enum(['open', 'any', 'not_closed']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  window_days: z.coerce.number().int().min(1).max(365).optional(),
  min_confidence: z.coerce.number().min(0).max(1).optional(),
});

/**
 * Session-cookie org resolution. Mirrors resolveSessionIdentity in
 * agent.routes.ts but returns only the org_id. Returns null if the
 * session is missing, invalid, or expired.
 */
async function resolveSessionOrgId(sessionCookie: string | undefined): Promise<string | null> {
  if (!sessionCookie) return null;
  try {
    const result = await db.execute(
      sql`SELECT u.org_id AS org_id
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.id = ${sessionCookie} AND s.expires_at > now()
          LIMIT 1`,
    );
    const row = Array.isArray(result) ? result[0] : (result as any).rows?.[0];
    return (row as any)?.org_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Derive the org from the agent's Bam user row. The agent key's
 * bbb_user_id is re-verified here (agent-auth.requireAgentAuth only
 * rejects invalid keys; it doesn't populate the user id).
 */
async function resolveAgentOrgId(request: FastifyRequest): Promise<string | null> {
  const token = request.headers['x-agent-key'] as string | undefined;
  const userId = await verifyAgentApiKey(request, token);
  if (!userId) return null;
  try {
    const [row] = await db
      .select({ org_id: users.org_id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return (row?.org_id as string | null) ?? null;
  } catch {
    return null;
  }
}

async function resolveRequestOrgId(request: FastifyRequest): Promise<string | null> {
  const sessionOrg = await resolveSessionOrgId(request.cookies?.session);
  if (sessionOrg) return sessionOrg;
  return resolveAgentOrgId(request);
}

export default async function dedupeRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/helpdesk/agents/tickets/:id/similar',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAgentAuth],
    },
    async (request, reply) => {
      const scopeOrgId = await resolveRequestOrgId(request);
      if (!scopeOrgId) {
        return reply.status(403).send({
          error: {
            code: 'ORG_CONTEXT_REQUIRED',
            message:
              'Organization context is required. Authenticate with a Bam session cookie or use an agent key linked to a user with an org.',
            details: [],
            request_id: request.id,
          },
        });
      }
      const query = querySchema.parse(request.query);

      try {
        const result = await similarTicketsService.findSimilarTickets({
          ticket_id: request.params.id,
          org_id: scopeOrgId,
          status_filter: query.status_filter,
          limit: query.limit,
          window_days: query.window_days,
          min_confidence: query.min_confidence,
        });
        return reply.send(result);
      } catch (err) {
        if (err instanceof similarTicketsService.SimilarTicketsError) {
          return reply.status(err.statusCode).send({
            error: {
              code: err.code,
              message: err.message,
              details: [],
              request_id: request.id,
            },
          });
        }
        throw err;
      }
    },
  );
}
