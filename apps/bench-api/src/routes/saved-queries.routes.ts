import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import * as savedQueryService from '../services/saved-query.service.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  data_source: z.string().min(1).max(30),
  entity: z.string().min(1).max(60),
  query_config: z.record(z.unknown()),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  data_source: z.string().min(1).max(30).optional(),
  entity: z.string().min(1).max(60).optional(),
  query_config: z.record(z.unknown()).optional(),
});

export default async function savedQueryRoutes(fastify: FastifyInstance) {
  // GET /saved-queries
  fastify.get(
    '/saved-queries',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await savedQueryService.listSavedQueries(
        request.user!.org_id,
      );
      return reply.send(result);
    },
  );

  // GET /saved-queries/:id
  fastify.get<{ Params: { id: string } }>(
    '/saved-queries/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const row = await savedQueryService.getSavedQuery(
        request.params.id,
        request.user!.org_id,
      );
      return reply.send({ data: row });
    },
  );

  // POST /saved-queries
  fastify.post(
    '/saved-queries',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const body = createSchema.parse(request.body);
      const row = await savedQueryService.createSavedQuery(
        body,
        request.user!.org_id,
        request.user!.id,
      );
      return reply.status(201).send({ data: row });
    },
  );

  // PATCH /saved-queries/:id
  fastify.patch<{ Params: { id: string } }>(
    '/saved-queries/:id',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const body = updateSchema.parse(request.body);
      const row = await savedQueryService.updateSavedQuery(
        request.params.id,
        request.user!.org_id,
        body,
      );
      return reply.send({ data: row });
    },
  );

  // DELETE /saved-queries/:id
  fastify.delete<{ Params: { id: string } }>(
    '/saved-queries/:id',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      await savedQueryService.deleteSavedQuery(
        request.params.id,
        request.user!.org_id,
      );
      return reply.send({ data: { deleted: true } });
    },
  );
}
