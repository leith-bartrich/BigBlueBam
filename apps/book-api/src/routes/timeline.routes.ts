import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import * as timelineService from '../services/timeline.service.js';

const timelineQuerySchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
});

export default async function timelineRoutes(fastify: FastifyInstance) {
  // GET /timeline
  fastify.get(
    '/timeline',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = timelineQuerySchema.parse(request.query);
      const result = await timelineService.getTimeline(
        request.user!.org_id,
        query.start_date,
        query.end_date,
        request.headers.cookie,
      );
      return reply.send(result);
    },
  );
}
