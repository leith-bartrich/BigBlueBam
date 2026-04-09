import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import {
  requireMinOrgRole,
  requireGoalAccess,
  requireGoalEditAccess,
} from '../middleware/authorize.js';
import * as goalService from '../services/goal.service.js';

const GOAL_SCOPES = ['organization', 'project', 'team', 'individual'] as const;
const GOAL_STATUSES = ['draft', 'on_track', 'at_risk', 'behind', 'achieved', 'missed'] as const;

const createGoalSchema = z.object({
  period_id: z.string().uuid(),
  scope: z.enum(GOAL_SCOPES).optional(),
  project_id: z.string().uuid().nullable().optional(),
  team_name: z.string().max(100).nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  owner_id: z.string().uuid().nullable().optional(),
});

const updateGoalSchema = z.object({
  period_id: z.string().uuid().optional(),
  scope: z.enum(GOAL_SCOPES).optional(),
  project_id: z.string().uuid().nullable().optional(),
  team_name: z.string().max(100).nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  owner_id: z.string().uuid().nullable().optional(),
});

const listGoalsQuerySchema = z.object({
  period_id: z.string().uuid().optional(),
  scope: z.enum(GOAL_SCOPES).optional(),
  project_id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  search: z.string().max(500).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const statusOverrideSchema = z.object({
  status: z.enum(GOAL_STATUSES),
});

const createUpdateSchema = z.object({
  status: z.enum(GOAL_STATUSES),
  body: z.string().max(10000).nullable().optional(),
});

export default async function goalRoutes(fastify: FastifyInstance) {
  // GET /goals — List goals (filterable)
  fastify.get(
    '/goals',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = listGoalsQuerySchema.parse(request.query);
      const result = await goalService.listGoals({
        orgId: request.user!.org_id,
        periodId: query.period_id,
        scope: query.scope,
        projectId: query.project_id,
        ownerId: query.owner_id,
        status: query.status,
        search: query.search,
        cursor: query.cursor,
        limit: query.limit,
      });
      return reply.send(result);
    },
  );

  // POST /goals — Create goal
  fastify.post(
    '/goals',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireMinOrgRole('member'), requireScope('read_write')],
    },
    async (request, reply) => {
      const data = createGoalSchema.parse(request.body);
      const goal = await goalService.createGoal(data, request.user!.id, request.user!.org_id);
      return reply.status(201).send({ data: goal });
    },
  );

  // GET /goals/:id — Get goal with KRs
  fastify.get<{ Params: { id: string } }>(
    '/goals/:id',
    { preHandler: [requireAuth, requireGoalAccess()] },
    async (request, reply) => {
      const goal = await goalService.getGoal(
        (request as any).goal.id,
        request.user!.org_id,
        fastify.redis,
      );
      return reply.send({ data: goal });
    },
  );

  // PATCH /goals/:id — Update goal
  fastify.patch<{ Params: { id: string } }>(
    '/goals/:id',
    { preHandler: [requireAuth, requireGoalEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const data = updateGoalSchema.parse(request.body);
      const goal = await goalService.updateGoal(
        (request as any).goal.id,
        data,
        request.user!.org_id,
        fastify.redis,
      );
      return reply.send({ data: goal });
    },
  );

  // DELETE /goals/:id — Delete goal
  fastify.delete<{ Params: { id: string } }>(
    '/goals/:id',
    { preHandler: [requireAuth, requireGoalEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      await goalService.deleteGoal((request as any).goal.id, request.user!.org_id);
      return reply.status(204).send();
    },
  );

  // POST /goals/:id/status — Override status
  fastify.post<{ Params: { id: string } }>(
    '/goals/:id/status',
    { preHandler: [requireAuth, requireGoalEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const { status } = statusOverrideSchema.parse(request.body);
      const goal = await goalService.overrideStatus(
        (request as any).goal.id,
        status,
        request.user!.org_id,
        fastify.redis,
      );
      return reply.send({ data: goal });
    },
  );

  // GET /goals/:id/updates — List updates
  fastify.get<{ Params: { id: string } }>(
    '/goals/:id/updates',
    { preHandler: [requireAuth, requireGoalAccess()] },
    async (request, reply) => {
      const result = await goalService.listUpdates(
        (request as any).goal.id,
        request.user!.org_id,
      );
      return reply.send(result);
    },
  );

  // POST /goals/:id/updates — Post update
  fastify.post<{ Params: { id: string } }>(
    '/goals/:id/updates',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireGoalEditAccess(), requireScope('read_write')],
    },
    async (request, reply) => {
      const data = createUpdateSchema.parse(request.body);
      const update = await goalService.createUpdate(
        (request as any).goal.id,
        data,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.status(201).send({ data: update });
    },
  );

  // GET /goals/:id/watchers — List watchers
  fastify.get<{ Params: { id: string } }>(
    '/goals/:id/watchers',
    { preHandler: [requireAuth, requireGoalAccess()] },
    async (request, reply) => {
      const result = await goalService.listWatchers(
        (request as any).goal.id,
        request.user!.org_id,
      );
      return reply.send(result);
    },
  );

  // POST /goals/:id/watchers — Add watcher
  fastify.post<{ Params: { id: string } }>(
    '/goals/:id/watchers',
    { preHandler: [requireAuth, requireGoalAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const watcher = await goalService.addWatcher(
        (request as any).goal.id,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.status(201).send({ data: watcher });
    },
  );

  // DELETE /goals/:id/watchers/:userId — Remove watcher
  // Users can remove themselves. Goal owner or org admin/owner can remove others.
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/goals/:id/watchers/:userId',
    { preHandler: [requireAuth, requireGoalAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(request.params.userId)) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'Valid user id is required',
            details: [],
            request_id: request.id,
          },
        });
      }

      const targetUserId = request.params.userId;
      const callerId = request.user!.id;
      const callerRole = request.user!.role;
      const goal = (request as any).goal;

      // Allow: removing yourself, or goal owner removing others, or org admin/owner
      const isSelf = callerId === targetUserId;
      const isGoalOwner = goal.owner_id === callerId;
      const isOrgAdminOrOwner = callerRole === 'admin' || callerRole === 'owner';

      if (!isSelf && !isGoalOwner && !isOrgAdminOrOwner) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You can only remove yourself as a watcher unless you are the goal owner or an org admin',
            details: [],
            request_id: request.id,
          },
        });
      }

      await goalService.removeWatcher(
        goal.id,
        targetUserId,
        request.user!.org_id,
      );
      return reply.status(204).send();
    },
  );

  // GET /goals/:id/history — Progress history
  fastify.get<{ Params: { id: string } }>(
    '/goals/:id/history',
    { preHandler: [requireAuth, requireGoalAccess()] },
    async (request, reply) => {
      const result = await goalService.getGoalHistory(
        (request as any).goal.id,
        request.user!.org_id,
      );
      return reply.send(result);
    },
  );
}
