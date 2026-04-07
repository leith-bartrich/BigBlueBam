import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireDocumentAccess, requireDocumentEditAccess } from '../middleware/authorize.js';
import * as versionService from '../services/version.service.js';

const createVersionSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  change_summary: z.string().max(1000).nullable().optional(),
});

export default async function versionRoutes(fastify: FastifyInstance) {
  // GET /documents/:id/versions — List version history
  fastify.get<{ Params: { id: string } }>(
    '/documents/:id/versions',
    { preHandler: [requireAuth, requireDocumentAccess()] },
    async (request, reply) => {
      const doc = (request as any).document;
      const versions = await versionService.listVersions(doc.id);
      return reply.send({ data: versions });
    },
  );

  // POST /documents/:id/versions — Create a named snapshot
  fastify.post<{ Params: { id: string } }>(
    '/documents/:id/versions',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireDocumentEditAccess(), requireScope('read_write')],
    },
    async (request, reply) => {
      const data = createVersionSchema.parse(request.body ?? {});
      const doc = (request as any).document;
      const version = await versionService.createVersion(
        doc.id,
        data,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.status(201).send({ data: version });
    },
  );

  // GET /documents/:id/versions/:versionId — Get a specific version
  fastify.get<{ Params: { id: string; versionId: string } }>(
    '/documents/:id/versions/:versionId',
    { preHandler: [requireAuth, requireDocumentAccess()] },
    async (request, reply) => {
      const doc = (request as any).document;
      const version = await versionService.getVersion(doc.id, request.params.versionId);

      if (!version) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Version not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      return reply.send({ data: version });
    },
  );

  // POST /documents/:id/versions/:versionId/restore — Restore a version
  fastify.post<{ Params: { id: string; versionId: string } }>(
    '/documents/:id/versions/:versionId/restore',
    { preHandler: [requireAuth, requireDocumentEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const doc = (request as any).document;
      const restored = await versionService.restoreVersion(
        doc.id,
        request.params.versionId,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.send({ data: restored });
    },
  );
}
