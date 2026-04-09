import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { listDataSources, getDataSource } from '../lib/data-source-registry.js';
import * as queryService from '../services/query.service.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const previewQuerySchema = z.object({
  data_source: z.string().min(1).max(30),
  entity: z.string().min(1).max(60),
  query_config: z.object({
    measures: z.array(z.object({
      field: z.string(),
      agg: z.enum(['count', 'sum', 'avg', 'min', 'max']),
      alias: z.string().optional(),
    })).min(1),
    dimensions: z.array(z.object({
      field: z.string(),
      alias: z.string().optional(),
    })).optional(),
    filters: z.array(z.object({
      field: z.string(),
      op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is_null', 'is_not_null', 'between', 'like']),
      value: z.unknown(),
    })).optional(),
    sort: z.array(z.object({ field: z.string(), dir: z.enum(['asc', 'desc']) })).optional(),
    limit: z.number().int().positive().max(10000).optional(),
    time_dimension: z.object({
      field: z.string(),
      granularity: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']),
    }).optional(),
    date_range: z.object({
      preset: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function dataSourceRoutes(fastify: FastifyInstance) {
  // GET /data-sources — List all data sources
  fastify.get(
    '/data-sources',
    { preHandler: [requireAuth] },
    async (_request, reply) => {
      const sources = listDataSources();
      return reply.send({ data: sources });
    },
  );

  // GET /data-sources/:product/:entity — Get data source detail
  fastify.get<{ Params: { product: string; entity: string } }>(
    '/data-sources/:product/:entity',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const source = getDataSource(request.params.product, request.params.entity);
      if (!source) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Data source not found: ${request.params.product}.${request.params.entity}`,
            details: [],
            request_id: request.id,
          },
        });
      }
      return reply.send({ data: source });
    },
  );

  // POST /query/preview — Ad-hoc query preview
  fastify.post(
    '/query/preview',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const body = previewQuerySchema.parse(request.body);
      const result = await queryService.executeQuery(
        body.data_source,
        body.entity,
        body.query_config,
        request.user!.org_id,
      );
      return reply.send({ data: result });
    },
  );
}
