import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import * as dedupeService from '../services/dedupe.service.js';

/**
 * Bond dedupe routes (Wave 5 AGENTIC_TODO §7).
 *
 *   GET /v1/contacts/:id/duplicates
 *
 * Returns ranked duplicate candidates for a single contact plus, for
 * each pair, any prior decision row from dedupe_decisions so callers
 * can suppress already-resolved duplicates. "Own only" visibility is
 * applied for member / viewer roles just like the list endpoint.
 */

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  min_confidence: z.coerce.number().min(0).max(1).optional(),
});

export default async function dedupeRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/contacts/:id/duplicates',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const query = querySchema.parse(request.query);
      const role = request.user!.role;
      const isRestrictedRole = role === 'member' || role === 'viewer';
      const result = await dedupeService.findDuplicateContacts({
        contact_id: request.params.id,
        org_id: request.user!.org_id,
        limit: query.limit,
        min_confidence: query.min_confidence,
        visibility_owner_id: isRestrictedRole ? request.user!.id : undefined,
      });
      return reply.send(result);
    },
  );
}
