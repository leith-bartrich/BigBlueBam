import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import * as externalSyncService from '../services/external-sync.service.js';

const connectGoogleSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  external_calendar_id: z.string(),
  sync_direction: z.enum(['inbound', 'outbound', 'both']).optional(),
});

const connectMicrosoftSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  external_calendar_id: z.string(),
  sync_direction: z.enum(['inbound', 'outbound', 'both']).optional(),
});

export default async function connectionRoutes(fastify: FastifyInstance) {
  // GET /connections
  fastify.get(
    '/connections',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await externalSyncService.listConnections(request.user!.id);
      return reply.send(result);
    },
  );

  // POST /connections/google
  fastify.post(
    '/connections/google',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = connectGoogleSchema.parse(request.body);
      const connection = await externalSyncService.createConnection(
        request.user!.id,
        'google',
        body.access_token,
        body.refresh_token,
        body.external_calendar_id,
        body.sync_direction,
      );
      return reply.status(201).send({ data: connection });
    },
  );

  // POST /connections/microsoft
  fastify.post(
    '/connections/microsoft',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = connectMicrosoftSchema.parse(request.body);
      const connection = await externalSyncService.createConnection(
        request.user!.id,
        'microsoft',
        body.access_token,
        body.refresh_token,
        body.external_calendar_id,
        body.sync_direction,
      );
      return reply.status(201).send({ data: connection });
    },
  );

  // DELETE /connections/:id
  fastify.delete<{ Params: { id: string } }>(
    '/connections/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      await externalSyncService.deleteConnection(request.params.id, request.user!.id);
      return reply.send({ data: { deleted: true } });
    },
  );

  // POST /connections/:id/sync
  fastify.post<{ Params: { id: string } }>(
    '/connections/:id/sync',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await externalSyncService.forceSync(request.params.id, request.user!.id);
      return reply.send({ data: result });
    },
  );
}
