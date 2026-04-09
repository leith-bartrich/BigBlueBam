import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireMinOrgRole, requireGoalAccess } from '../middleware/authorize.js';
import * as krService from '../services/key-result.service.js';

const METRIC_TYPES = ['percentage', 'number', 'currency', 'boolean'] as const;
const DIRECTIONS = ['increase', 'decrease'] as const;
const PROGRESS_MODES = ['manual', 'linked'] as const;
const LINKED_TARGET_TYPES = ['task', 'tasks', 'epic', 'sprint'] as const;

/** Strict schema for linked_query — only known fields allowed. */
const linkedQuerySchema = z
  .object({
    target_type: z.enum(LINKED_TARGET_TYPES),
    project_id: z.string().uuid().optional(),
    phase_id: z.string().uuid().optional(),
    sprint_id: z.string().uuid().optional(),
    label: z.string().max(100).optional(),
    assignee_id: z.string().uuid().optional(),
    status: z.string().max(50).optional(),
  })
  .strict()
  .nullable()
  .optional();

const createKeyResultSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  metric_type: z.enum(METRIC_TYPES).optional(),
  target_value: z.number().optional(),
  current_value: z.number().optional(),
  start_value: z.number().optional(),
  unit: z.string().max(50).nullable().optional(),
  direction: z.enum(DIRECTIONS).optional(),
  progress_mode: z.enum(PROGRESS_MODES).optional(),
  linked_query: linkedQuerySchema,
  owner_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
});

const updateKeyResultSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  metric_type: z.enum(METRIC_TYPES).optional(),
  target_value: z.number().optional(),
  current_value: z.number().optional(),
  start_value: z.number().optional(),
  unit: z.string().max(50).nullable().optional(),
  direction: z.enum(DIRECTIONS).optional(),
  progress_mode: z.enum(PROGRESS_MODES).optional(),
  linked_query: linkedQuerySchema,
  owner_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
});

const setValueSchema = z.object({
  value: z.number(),
});

const LINK_TYPES = ['epic', 'project', 'task_query', 'task', 'sprint'] as const;
const TARGET_TYPES = ['task', 'epic', 'project', 'sprint', 'goal'] as const;

const addLinkSchema = z.object({
  link_type: z.enum(LINK_TYPES),
  target_type: z.enum(TARGET_TYPES),
  target_id: z.string().uuid(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function keyResultRoutes(fastify: FastifyInstance) {
  // GET /goals/:id/key-results — List KRs for goal
  fastify.get<{ Params: { id: string } }>(
    '/goals/:id/key-results',
    { preHandler: [requireAuth, requireGoalAccess()] },
    async (request, reply) => {
      const result = await krService.listKeyResults((request as any).goal.id);
      return reply.send(result);
    },
  );

  // POST /goals/:id/key-results — Create KR
  fastify.post<{ Params: { id: string } }>(
    '/goals/:id/key-results',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireGoalAccess(), requireMinOrgRole('member'), requireScope('read_write')],
    },
    async (request, reply) => {
      const goalId = (request as any).goal.id;
      const data = createKeyResultSchema.parse(request.body);
      const kr = await krService.createKeyResult(goalId, data, request.user!.org_id);
      return reply.status(201).send({ data: kr });
    },
  );

  // GET /key-results/:id — Get KR
  fastify.get<{ Params: { id: string } }>(
    '/key-results/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params;
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'Valid key result id is required',
            details: [],
            request_id: request.id,
          },
        });
      }

      const kr = await krService.getKeyResultWithOrgCheck(id, request.user!.org_id);
      if (!kr) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Key result not found',
            details: [],
            request_id: request.id,
          },
        });
      }
      return reply.send({ data: kr });
    },
  );

  // PATCH /key-results/:id — Update KR
  fastify.patch<{ Params: { id: string } }>(
    '/key-results/:id',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireMinOrgRole('member'), requireScope('read_write')],
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = updateKeyResultSchema.parse(request.body);
      const kr = await krService.updateKeyResult(id, data, request.user!.org_id);
      return reply.send({ data: kr });
    },
  );

  // DELETE /key-results/:id — Delete KR
  fastify.delete<{ Params: { id: string } }>(
    '/key-results/:id',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireMinOrgRole('member'), requireScope('read_write')],
    },
    async (request, reply) => {
      await krService.deleteKeyResult(request.params.id, request.user!.org_id);
      return reply.status(204).send();
    },
  );

  // POST /key-results/:id/value — Set current value
  fastify.post<{ Params: { id: string } }>(
    '/key-results/:id/value',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireScope('read_write')],
    },
    async (request, reply) => {
      const { value } = setValueSchema.parse(request.body);
      const kr = await krService.setCurrentValue(request.params.id, value, request.user!.org_id);
      return reply.send({ data: kr });
    },
  );

  // GET /key-results/:id/links — List links
  fastify.get<{ Params: { id: string } }>(
    '/key-results/:id/links',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await krService.listLinks(request.params.id, request.user!.org_id);
      return reply.send(result);
    },
  );

  // POST /key-results/:id/links — Add link
  fastify.post<{ Params: { id: string } }>(
    '/key-results/:id/links',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireScope('read_write')],
    },
    async (request, reply) => {
      const data = addLinkSchema.parse(request.body);
      const link = await krService.addLink(request.params.id, data, request.user!.org_id);
      return reply.status(201).send({ data: link });
    },
  );

  // DELETE /key-results/:id/links/:linkId — Remove link
  fastify.delete<{ Params: { id: string; linkId: string } }>(
    '/key-results/:id/links/:linkId',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      await krService.removeLink(request.params.linkId, request.user!.org_id);
      return reply.status(204).send();
    },
  );

  // GET /key-results/:id/history — Snapshot history
  fastify.get<{ Params: { id: string } }>(
    '/key-results/:id/history',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await krService.getHistory(request.params.id, request.user!.org_id);
      return reply.send(result);
    },
  );
}
