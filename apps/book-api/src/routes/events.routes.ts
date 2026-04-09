import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireMinRole, requireScope } from '../plugins/auth.js';
import * as eventService from '../services/event.service.js';
import { publishBoltEvent } from '../lib/bolt-events.js';

const createEventSchema = z.object({
  calendar_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  meeting_url: z.string().url().optional(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  all_day: z.boolean().optional(),
  timezone: z.string().max(50).optional(),
  recurrence_rule: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
  recurrence_end_at: z.string().datetime().optional(),
  status: z.enum(['tentative', 'confirmed', 'cancelled']).optional(),
  visibility: z.enum(['free', 'busy', 'tentative', 'out_of_office']).optional(),
  linked_entity_type: z.enum(['bam_task', 'bond_deal', 'helpdesk_ticket']).optional(),
  linked_entity_id: z.string().uuid().optional(),
  attendees: z
    .array(
      z.object({
        user_id: z.string().uuid().optional(),
        email: z.string().email(),
        name: z.string().max(200).optional(),
        is_organizer: z.boolean().optional(),
      }),
    )
    .optional(),
});

const updateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  meeting_url: z.string().url().optional().nullable(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
  all_day: z.boolean().optional(),
  timezone: z.string().max(50).optional(),
  status: z.enum(['tentative', 'confirmed', 'cancelled']).optional(),
  visibility: z.enum(['free', 'busy', 'tentative', 'out_of_office']).optional(),
});

const rsvpSchema = z.object({
  response_status: z.enum(['accepted', 'declined', 'tentative']),
});

const listQuerySchema = z.object({
  calendar_ids: z.string().optional(), // comma-separated UUIDs
  start_after: z.string().datetime().optional(),
  start_before: z.string().datetime().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default async function eventRoutes(fastify: FastifyInstance) {
  // GET /events
  fastify.get(
    '/events',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const calendar_ids = query.calendar_ids?.split(',').filter(Boolean);
      const result = await eventService.listEvents({
        organization_id: request.user!.org_id,
        calendar_ids,
        start_after: query.start_after,
        start_before: query.start_before,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });
      return reply.send(result);
    },
  );

  // POST /events
  fastify.post(
    '/events',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireMinRole('member'), requireScope('read_write')],
    },
    async (request, reply) => {
      const body = createEventSchema.parse(request.body);
      const event = await eventService.createEvent(
        body,
        request.user!.org_id,
        request.user!.id,
      );
      publishBoltEvent('event.created', 'book', {
        id: event.id,
        title: event.title,
        start_at: event.start_at,
        end_at: event.end_at,
        status: event.status,
        created_by: request.user!.id,
      }, request.user!.org_id);
      return reply.status(201).send({ data: event });
    },
  );

  // GET /events/:id
  fastify.get<{ Params: { id: string } }>(
    '/events/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const event = await eventService.getEvent(
        request.params.id,
        request.user!.org_id,
      );
      return reply.send({ data: event });
    },
  );

  // PATCH /events/:id
  fastify.patch<{ Params: { id: string } }>(
    '/events/:id',
    { preHandler: [requireAuth, requireMinRole('member'), requireScope('read_write')] },
    async (request, reply) => {
      const body = updateEventSchema.parse(request.body);
      const event = await eventService.updateEvent(
        request.params.id,
        request.user!.org_id,
        body,
      );
      publishBoltEvent('event.updated', 'book', {
        id: event.id,
        title: event.title,
        start_at: event.start_at,
        end_at: event.end_at,
        status: event.status,
        updated_by: request.user!.id,
      }, request.user!.org_id);
      return reply.send({ data: event });
    },
  );

  // DELETE /events/:id
  fastify.delete<{ Params: { id: string } }>(
    '/events/:id',
    { preHandler: [requireAuth, requireMinRole('member'), requireScope('read_write')] },
    async (request, reply) => {
      const event = await eventService.deleteEvent(
        request.params.id,
        request.user!.org_id,
      );
      return reply.send({ data: event });
    },
  );

  // POST /events/:id/rsvp
  fastify.post<{ Params: { id: string } }>(
    '/events/:id/rsvp',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = rsvpSchema.parse(request.body);
      const attendee = await eventService.rsvpEvent(
        request.params.id,
        request.user!.org_id,
        request.user!.id,
        body.response_status,
      );
      return reply.send({ data: attendee });
    },
  );
}
