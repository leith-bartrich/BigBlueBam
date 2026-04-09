import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth } from '../plugins/auth.js';
import * as availabilityService from '../services/availability.service.js';
import { db } from '../db/index.js';
import { organizationMemberships } from '../db/schema/index.js';

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

      // BOOK-003: Verify target user belongs to the same org as the requester
      const [membership] = await db
        .select({ user_id: organizationMemberships.user_id })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.user_id, request.params.userId),
            eq(organizationMemberships.org_id, request.user!.org_id),
          ),
        )
        .limit(1);

      if (!membership) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
            details: [],
            request_id: request.id,
          },
        });
      }

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
      const requestedIds = query.user_ids.split(',').filter(Boolean);

      // BOOK-004: Filter user_ids to only include same-org users
      const sameOrgMembers = requestedIds.length > 0
        ? await db
            .select({ user_id: organizationMemberships.user_id })
            .from(organizationMemberships)
            .where(
              and(
                inArray(organizationMemberships.user_id, requestedIds),
                eq(organizationMemberships.org_id, request.user!.org_id),
              ),
            )
        : [];

      const userIds = sameOrgMembers.map((m) => m.user_id);

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
