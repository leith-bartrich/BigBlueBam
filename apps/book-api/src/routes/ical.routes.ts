import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import * as icalService from '../services/ical.service.js';

export default async function icalRoutes(fastify: FastifyInstance) {
  // POST /calendars/:id/ical — generate iCal feed token
  fastify.post<{ Params: { id: string } }>(
    '/calendars/:id/ical',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const token = await icalService.generateIcalToken(
        request.params.id,
        request.user!.id,
      );
      return reply.status(201).send({ data: token });
    },
  );

  // GET /calendars/:id/ical — get iCal feed (public, authenticated by token query param)
  fastify.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    '/calendars/:id/ical',
    async (request, reply) => {
      const token = (request.query as { token?: string }).token;
      if (!token) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token required' } });
      }

      const content = await icalService.getIcalFeed(token);
      return reply
        .type('text/calendar; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="calendar.ics"')
        .send(content);
    },
  );
}
