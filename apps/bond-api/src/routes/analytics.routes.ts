import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import * as analyticsService from '../services/analytics.service.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const pipelineQuerySchema = z.object({
  pipeline_id: z.string().uuid().optional(),
});

const conversionQuerySchema = z.object({
  pipeline_id: z.string().uuid(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

const velocityQuerySchema = z.object({
  pipeline_id: z.string().uuid(),
});

const winLossQuerySchema = z.object({
  pipeline_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // GET /analytics/pipeline-summary — Pipeline value by stage
  fastify.get(
    '/analytics/pipeline-summary',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = pipelineQuerySchema.parse(request.query);
      const summary = await analyticsService.pipelineSummary(
        request.user!.org_id,
        query.pipeline_id,
      );
      return reply.send({ data: summary });
    },
  );

  // GET /analytics/conversion-rates — Stage-to-stage conversion
  fastify.get(
    '/analytics/conversion-rates',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = conversionQuerySchema.parse(request.query);
      const rates = await analyticsService.conversionRates(
        request.user!.org_id,
        query.pipeline_id,
        query.start_date,
        query.end_date,
      );
      return reply.send({ data: rates });
    },
  );

  // GET /analytics/deal-velocity — Average time in each stage
  fastify.get(
    '/analytics/deal-velocity',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = velocityQuerySchema.parse(request.query);
      const velocity = await analyticsService.dealVelocity(
        request.user!.org_id,
        query.pipeline_id,
      );
      return reply.send({ data: velocity });
    },
  );

  // GET /analytics/forecast — Revenue forecast
  fastify.get(
    '/analytics/forecast',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = pipelineQuerySchema.parse(request.query);
      const data = await analyticsService.forecast(
        request.user!.org_id,
        query.pipeline_id,
      );
      return reply.send({ data });
    },
  );

  // GET /analytics/stale-deals — Deals exceeding rotting threshold
  fastify.get(
    '/analytics/stale-deals',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = pipelineQuerySchema.parse(request.query);
      const data = await analyticsService.staleDeals(
        request.user!.org_id,
        query.pipeline_id,
      );
      return reply.send({ data });
    },
  );

  // GET /analytics/win-loss — Win/loss ratio and analysis
  fastify.get(
    '/analytics/win-loss',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = winLossQuerySchema.parse(request.query);
      const data = await analyticsService.winLossRate(
        request.user!.org_id,
        query.pipeline_id,
        query.start_date,
        query.end_date,
      );
      return reply.send({ data });
    },
  );
}
