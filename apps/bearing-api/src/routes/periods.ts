import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireMinOrgRole } from '../middleware/authorize.js';
import * as periodService from '../services/period.service.js';

const PERIOD_TYPES = ['annual', 'semi_annual', 'quarterly', 'monthly', 'custom'] as const;
const PERIOD_STATUSES = ['planning', 'active', 'completed'] as const;

const createPeriodSchema = z.object({
  name: z.string().min(1).max(100),
  period_type: z.enum(PERIOD_TYPES),
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(PERIOD_STATUSES).optional(),
});

const updatePeriodSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  period_type: z.enum(PERIOD_TYPES).optional(),
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(PERIOD_STATUSES).optional(),
});

const listPeriodsQuerySchema = z.object({
  status: z.enum(PERIOD_STATUSES).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export default async function periodRoutes(fastify: FastifyInstance) {
  // GET /periods — List periods
  fastify.get(
    '/periods',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = listPeriodsQuerySchema.parse(request.query);
      const result = await periodService.listPeriods({
        orgId: request.user!.org_id,
        status: query.status,
        year: query.year,
        cursor: query.cursor,
        limit: query.limit,
      });
      return reply.send(result);
    },
  );

  // POST /periods — Create period
  fastify.post(
    '/periods',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireMinOrgRole('admin'), requireScope('read_write')],
    },
    async (request, reply) => {
      const data = createPeriodSchema.parse(request.body);
      const period = await periodService.createPeriod(data, request.user!.id, request.user!.org_id);
      return reply.status(201).send({ data: period });
    },
  );

  // GET /periods/:id — Get period with stats
  fastify.get<{ Params: { id: string } }>(
    '/periods/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const period = await periodService.getPeriod(request.params.id, request.user!.org_id);
      if (!period) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Period not found',
            details: [],
            request_id: request.id,
          },
        });
      }
      return reply.send({ data: period });
    },
  );

  // PATCH /periods/:id — Update period
  fastify.patch<{ Params: { id: string } }>(
    '/periods/:id',
    { preHandler: [requireAuth, requireMinOrgRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const data = updatePeriodSchema.parse(request.body);
      const period = await periodService.updatePeriod(
        request.params.id,
        data,
        request.user!.org_id,
      );
      return reply.send({ data: period });
    },
  );

  // DELETE /periods/:id — Delete period
  fastify.delete<{ Params: { id: string } }>(
    '/periods/:id',
    { preHandler: [requireAuth, requireMinOrgRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      await periodService.deletePeriod(request.params.id, request.user!.org_id);
      return reply.status(204).send();
    },
  );

  // POST /periods/:id/activate — Activate period
  fastify.post<{ Params: { id: string } }>(
    '/periods/:id/activate',
    { preHandler: [requireAuth, requireMinOrgRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const period = await periodService.activatePeriod(request.params.id, request.user!.org_id);
      return reply.send({ data: period });
    },
  );

  // POST /periods/:id/complete — Complete period
  fastify.post<{ Params: { id: string } }>(
    '/periods/:id/complete',
    { preHandler: [requireAuth, requireMinOrgRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const period = await periodService.completePeriod(request.params.id, request.user!.org_id);
      return reply.send({ data: period });
    },
  );
}
