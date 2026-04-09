import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import * as analyticsService from '../services/analytics.service.js';

const trendQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // GET /analytics/overview
  fastify.get(
    '/analytics/overview',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await analyticsService.getOverviewMetrics(request.user!.org_id);
      return reply.send({ data: result });
    },
  );

  // GET /analytics/engagement-trend
  fastify.get(
    '/analytics/engagement-trend',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = trendQuerySchema.parse(request.query);
      const result = await analyticsService.getEngagementTrend(
        request.user!.org_id,
        query.period,
      );
      return reply.send({ data: result });
    },
  );
}
