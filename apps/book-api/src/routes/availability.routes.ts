import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import * as availabilityService from '../services/availability.service.js';

const availabilityQuerySchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
});

const teamQuerySchema = z.object({
  user_ids: z.string(), // comma-separated UUIDs
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
});

const workingHoursSchema = z.array(
  z.object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    timezone: z.string().max(50).optional(),
    enabled: z.boolean().optional(),
  }),
);

export default async function availabilityRoutes(fastify: FastifyInstance) {
  // GET /availability/:userId
  fastify.get<{ Params: { userId: string } }>(
    '/availability/:userId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = availabilityQuerySchema.parse(request.query);
      const slots = await availabilityService.getAvailability(
        request.params.userId,
        query.start_date,
        query.end_date,
      );
      return reply.send({ data: slots });
    },
  );

  // GET /availability/team
  fastify.get(
    '/availability/team',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = teamQuerySchema.parse(request.query);
      const userIds = query.user_ids.split(',').filter(Boolean);
      const result = await availabilityService.getTeamAvailability(
        userIds,
        query.start_date,
        query.end_date,
      );
      return reply.send({ data: result });
    },
  );

  // GET /working-hours
  fastify.get(
    '/working-hours',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await availabilityService.getWorkingHours(request.user!.id);
      return reply.send(result);
    },
  );

  // PUT /working-hours
  fastify.put(
    '/working-hours',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const hours = workingHoursSchema.parse(request.body);
      const result = await availabilityService.setWorkingHours(request.user!.id, hours);
      return reply.send(result);
    },
  );
}
