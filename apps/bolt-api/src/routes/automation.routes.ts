import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import {
  requireMinOrgRole,
  requireAutomationAccess,
  requireAutomationEditAccess,
} from '../middleware/authorize.js';
import * as automationService from '../services/automation.service.js';

const TRIGGER_SOURCES = ['bam', 'banter', 'beacon', 'brief', 'helpdesk', 'schedule'] as const;
const CONDITION_OPERATORS = [
  'equals', 'not_equals', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'greater_than', 'less_than',
  'is_empty', 'is_not_empty', 'in', 'not_in', 'matches_regex',
] as const;
const LOGIC_GROUPS = ['and', 'or'] as const;
const ON_ERROR_MODES = ['stop', 'continue', 'retry'] as const;

const conditionSchema = z.object({
  sort_order: z.number().int().min(0).max(100),
  field: z.string().min(1).max(255),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.unknown().optional(),
  logic_group: z.enum(LOGIC_GROUPS).optional().default('and'),
});

const actionSchema = z.object({
  sort_order: z.number().int().min(0).max(100),
  mcp_tool: z.string().min(1).max(100),
  parameters: z.record(z.unknown()).optional(),
  on_error: z.enum(ON_ERROR_MODES).optional().default('stop'),
  retry_count: z.number().int().min(0).max(10).optional().default(0),
  retry_delay_ms: z.number().int().min(100).max(300000).optional().default(1000),
});

const createAutomationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional().default(true),
  trigger_source: z.enum(TRIGGER_SOURCES),
  trigger_event: z.string().min(1).max(60),
  trigger_filter: z.record(z.unknown()).nullable().optional(),
  cron_expression: z.string().max(100).nullable().optional(),
  cron_timezone: z.string().max(50).optional().default('UTC'),
  max_executions_per_hour: z.number().int().min(1).max(10000).optional().default(100),
  cooldown_seconds: z.number().int().min(0).max(86400).optional().default(0),
  conditions: z.array(conditionSchema).max(50).optional().default([]),
  actions: z.array(actionSchema).min(1).max(50),
});

const updateAutomationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
  trigger_source: z.enum(TRIGGER_SOURCES).optional(),
  trigger_event: z.string().min(1).max(60).optional(),
  trigger_filter: z.record(z.unknown()).nullable().optional(),
  cron_expression: z.string().max(100).nullable().optional(),
  cron_timezone: z.string().max(50).optional(),
  max_executions_per_hour: z.number().int().min(1).max(10000).optional(),
  cooldown_seconds: z.number().int().min(0).max(86400).optional(),
  conditions: z.array(conditionSchema).max(50).optional(),
  actions: z.array(actionSchema).min(1).max(50).optional(),
});

const patchAutomationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  enabled: z.boolean().optional(),
});

const listAutomationsQuerySchema = z.object({
  project_id: z.string().uuid().optional(),
  trigger_source: z.string().optional(),
  enabled: z.enum(['true', 'false']).optional(),
  search: z.string().max(500).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const testAutomationSchema = z.object({
  event: z.record(z.unknown()),
});

export default async function automationRoutes(fastify: FastifyInstance) {
  // GET /automations — List automations
  fastify.get(
    '/automations',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = listAutomationsQuerySchema.parse(request.query);
      const result = await automationService.listAutomations({
        orgId: request.user!.org_id,
        projectId: query.project_id,
        triggerSource: query.trigger_source,
        enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined,
        search: query.search,
        cursor: query.cursor,
        limit: query.limit,
      });
      return reply.send(result);
    },
  );

  // POST /automations — Create automation
  fastify.post(
    '/automations',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireMinOrgRole('member'), requireScope('read_write')],
    },
    async (request, reply) => {
      const data = createAutomationSchema.parse(request.body);
      const automation = await automationService.createAutomation(
        data as automationService.CreateAutomationInput,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.status(201).send({ data: automation });
    },
  );

  // GET /automations/stats — Automation statistics
  fastify.get(
    '/automations/stats',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const stats = await automationService.getStats(request.user!.org_id);
      return reply.send({ data: stats });
    },
  );

  // GET /automations/:id — Get automation with conditions and actions
  fastify.get<{ Params: { id: string } }>(
    '/automations/:id',
    { preHandler: [requireAuth, requireAutomationAccess()] },
    async (request, reply) => {
      const full = await automationService.getAutomation(
        (request as any).automation.id,
        request.user!.org_id,
      );
      return reply.send({ data: full });
    },
  );

  // PUT /automations/:id — Full update
  fastify.put<{ Params: { id: string } }>(
    '/automations/:id',
    { preHandler: [requireAuth, requireAutomationEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const data = updateAutomationSchema.parse(request.body);
      const automation = await automationService.updateAutomation(
        (request as any).automation.id,
        data as automationService.UpdateAutomationInput,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.send({ data: automation });
    },
  );

  // PATCH /automations/:id — Partial metadata update
  fastify.patch<{ Params: { id: string } }>(
    '/automations/:id',
    { preHandler: [requireAuth, requireAutomationEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const data = patchAutomationSchema.parse(request.body);
      const automation = await automationService.patchAutomation(
        (request as any).automation.id,
        data,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.send({ data: automation });
    },
  );

  // DELETE /automations/:id
  fastify.delete<{ Params: { id: string } }>(
    '/automations/:id',
    { preHandler: [requireAuth, requireAutomationEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      await automationService.deleteAutomation(
        (request as any).automation.id,
        request.user!.org_id,
      );
      return reply.status(204).send();
    },
  );

  // POST /automations/:id/enable
  fastify.post<{ Params: { id: string } }>(
    '/automations/:id/enable',
    { preHandler: [requireAuth, requireAutomationEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const automation = await automationService.enableAutomation(
        (request as any).automation.id,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.send({ data: automation });
    },
  );

  // POST /automations/:id/disable
  fastify.post<{ Params: { id: string } }>(
    '/automations/:id/disable',
    { preHandler: [requireAuth, requireAutomationEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const automation = await automationService.disableAutomation(
        (request as any).automation.id,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.send({ data: automation });
    },
  );

  // POST /automations/:id/duplicate
  fastify.post<{ Params: { id: string } }>(
    '/automations/:id/duplicate',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireAutomationAccess(), requireScope('read_write')],
    },
    async (request, reply) => {
      const automation = await automationService.duplicateAutomation(
        (request as any).automation.id,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.status(201).send({ data: automation });
    },
  );

  // POST /automations/:id/test — Test condition evaluation
  fastify.post<{ Params: { id: string } }>(
    '/automations/:id/test',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireAutomationAccess()],
    },
    async (request, reply) => {
      const { event } = testAutomationSchema.parse(request.body);
      const result = await automationService.testAutomation(
        (request as any).automation.id,
        event,
        request.user!.org_id,
      );
      return reply.send({ data: result });
    },
  );
}
