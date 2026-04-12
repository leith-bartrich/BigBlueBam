import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import * as dashboardService from '../services/dashboard.service.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  project_id: z.string().uuid().optional(),
  visibility: z.enum(['private', 'project', 'organization']).optional(),
  is_default: z.boolean().optional(),
  auto_refresh_seconds: z.number().int().positive().optional(),
  layout: z.array(z.record(z.unknown())).optional(),
});

const updateDashboardSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  project_id: z.string().uuid().nullable().optional(),
  visibility: z.enum(['private', 'project', 'organization']).optional(),
  is_default: z.boolean().optional(),
  auto_refresh_seconds: z.number().int().positive().nullable().optional(),
  layout: z.array(z.record(z.unknown())).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // GET /dashboards — List dashboards
  fastify.get(
    '/dashboards',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const dashboards = await dashboardService.listDashboards(request.user!.org_id, {
        project_id: query.project_id,
        visibility: query.visibility,
      });
      return reply.send({ data: dashboards });
    },
  );

  // POST /dashboards — Create dashboard
  fastify.post(
    '/dashboards',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireScope('read_write')],
    },
    async (request, reply) => {
      const body = createDashboardSchema.parse(request.body);
      const dashboard = await dashboardService.createDashboard(
        body,
        request.user!.org_id,
        request.user!.id,
      );
      return reply.status(201).send({ data: dashboard });
    },
  );

  // GET /dashboards/:id — Get dashboard with widgets
  fastify.get<{ Params: { id: string } }>(
    '/dashboards/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const dashboard = await dashboardService.getDashboard(
        request.params.id,
        request.user!.org_id,
      );
      return reply.send({ data: dashboard });
    },
  );

  // PATCH /dashboards/:id — Update dashboard
  fastify.patch<{ Params: { id: string } }>(
    '/dashboards/:id',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const body = updateDashboardSchema.parse(request.body);
      const dashboard = await dashboardService.updateDashboard(
        request.params.id,
        request.user!.org_id,
        request.user!.id,
        body,
        request.user!.role,
      );
      return reply.send({ data: dashboard });
    },
  );

  // DELETE /dashboards/:id — Delete dashboard
  fastify.delete<{ Params: { id: string } }>(
    '/dashboards/:id',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      await dashboardService.deleteDashboard(
        request.params.id,
        request.user!.org_id,
        request.user!.id,
        request.user!.role,
      );
      return reply.send({ data: { deleted: true } });
    },
  );

  // POST /dashboards/:id/duplicate — Clone dashboard
  fastify.post<{ Params: { id: string } }>(
    '/dashboards/:id/duplicate',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const dashboard = await dashboardService.duplicateDashboard(
        request.params.id,
        request.user!.org_id,
        request.user!.id,
      );
      return reply.status(201).send({ data: dashboard });
    },
  );

  // POST /dashboards/:id/export — Export dashboard (stub)
  fastify.post<{ Params: { id: string } }>(
    '/dashboards/:id/export',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const dashboard = await dashboardService.getDashboard(
        request.params.id,
        request.user!.org_id,
      );
      // In production, this would enqueue a Puppeteer-based PDF/PNG render.
      return reply.send({
        data: {
          dashboard_id: dashboard.id,
          status: 'queued',
          format: 'pdf',
          queued_at: new Date().toISOString(),
        },
      });
    },
  );
}
