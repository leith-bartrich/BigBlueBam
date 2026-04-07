import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireMinOrgRole } from '../middleware/authorize.js';
import * as folderService from '../services/folder.service.js';

const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  project_id: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional(),
});

const listFoldersQuerySchema = z.object({
  project_id: z.string().uuid().optional(),
});

export default async function folderRoutes(fastify: FastifyInstance) {
  // GET /folders — List folder tree for project/org
  fastify.get(
    '/folders',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = listFoldersQuerySchema.parse(request.query);
      const folders = await folderService.listFolders(
        request.user!.org_id,
        query.project_id,
      );
      return reply.send({ data: folders });
    },
  );

  // POST /folders — Create a folder
  fastify.post(
    '/folders',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireMinOrgRole('member'), requireScope('read_write')],
    },
    async (request, reply) => {
      const data = createFolderSchema.parse(request.body);
      const folder = await folderService.createFolder(
        data,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.status(201).send({ data: folder });
    },
  );

  // PATCH /folders/:id — Update a folder
  fastify.patch<{ Params: { id: string } }>(
    '/folders/:id',
    { preHandler: [requireAuth, requireMinOrgRole('member'), requireScope('read_write')] },
    async (request, reply) => {
      const data = updateFolderSchema.parse(request.body);
      const folder = await folderService.updateFolder(
        request.params.id,
        data,
        request.user!.org_id,
      );
      return reply.send({ data: folder });
    },
  );

  // DELETE /folders/:id — Delete a folder
  fastify.delete<{ Params: { id: string } }>(
    '/folders/:id',
    { preHandler: [requireAuth, requireMinOrgRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const deleted = await folderService.deleteFolder(
        request.params.id,
        request.user!.org_id,
      );
      return reply.send({ data: deleted });
    },
  );
}
