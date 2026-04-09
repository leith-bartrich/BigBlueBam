import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireBoardAccess, requireBoardEditAccess } from '../middleware/authorize.js';
import * as collaboratorService from '../services/collaborator.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PERMISSIONS = ['view', 'edit'] as const;

const addCollaboratorSchema = z.object({
  user_id: z.string().uuid(),
  permission: z.enum(PERMISSIONS).optional().default('edit'),
});

const updateCollaboratorSchema = z.object({
  permission: z.enum(PERMISSIONS),
});

export default async function collaboratorRoutes(fastify: FastifyInstance) {
  // GET /boards/:id/collaborators - List collaborators
  fastify.get<{ Params: { id: string } }>(
    '/boards/:id/collaborators',
    { preHandler: [requireAuth, requireBoardAccess()] },
    async (request, reply) => {
      const collaborators = await collaboratorService.listCollaborators(
        (request as any).board.id,
      );
      return reply.send({ data: collaborators });
    },
  );

  // POST /boards/:id/collaborators - Add collaborator
  fastify.post<{ Params: { id: string } }>(
    '/boards/:id/collaborators',
    { preHandler: [requireAuth, requireBoardEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const data = addCollaboratorSchema.parse(request.body);
      const collab = await collaboratorService.addCollaborator(
        (request as any).board.id,
        data,
        request.user!.org_id,
      );
      return reply.status(201).send({ data: collab });
    },
  );

  // PATCH /collaborators/:collabId - Update collaborator permission
  fastify.patch<{ Params: { collabId: string } }>(
    '/collaborators/:collabId',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const { collabId } = request.params;
      if (!collabId || !UUID_REGEX.test(collabId)) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'Valid collaborator id is required',
            details: [],
            request_id: request.id,
          },
        });
      }
      const data = updateCollaboratorSchema.parse(request.body);
      const collab = await collaboratorService.updateCollaborator(
        collabId,
        data,
        request.user!.org_id,
      );
      return reply.send({ data: collab });
    },
  );

  // DELETE /collaborators/:collabId - Remove collaborator
  fastify.delete<{ Params: { collabId: string } }>(
    '/collaborators/:collabId',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const { collabId } = request.params;
      if (!collabId || !UUID_REGEX.test(collabId)) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'Valid collaborator id is required',
            details: [],
            request_id: request.id,
          },
        });
      }
      await collaboratorService.deleteCollaborator(collabId, request.user!.org_id);
      return reply.status(204).send();
    },
  );
}
