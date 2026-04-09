import type { FastifyInstance } from 'fastify';
import * as activityService from '../services/activity.service.js';
import { requireAuth } from '../plugins/auth.js';
import { requireProjectAccess, requireProjectAccessForEntity } from '../middleware/authorize.js';

export default async function activityRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: { id: string };
    Querystring: { cursor?: string; limit?: string };
  }>(
    '/projects/:id/activity',
    { preHandler: [requireAuth, requireProjectAccess()] },
    async (request, reply) => {
      const result = await activityService.getProjectActivity(request.params.id, {
        cursor: request.query.cursor,
        limit: request.query.limit ? parseInt(request.query.limit, 10) : undefined,
      });

      return reply.send(result);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/tasks/:id/activity',
    { preHandler: [requireAuth, requireProjectAccessForEntity('task')] },
    async (request, reply) => {
      const data = await activityService.getTaskActivity(request.params.id);
      return reply.send({ data });
    },
  );
}
