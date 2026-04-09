import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireBoardAccess, requireBoardEditAccess } from '../middleware/authorize.js';
import { loadScene, saveScene, type SceneData } from '../ws/persistence.js';

const sceneBodySchema = z.object({
  elements: z.array(z.unknown()),
  appState: z.record(z.unknown()).optional(),
  files: z.record(z.unknown()).optional(),
});

export default async function sceneRoutes(fastify: FastifyInstance) {
  // GET /boards/:id/scene — Load saved Excalidraw scene
  fastify.get<{ Params: { id: string } }>(
    '/boards/:id/scene',
    { preHandler: [requireAuth, requireBoardAccess()] },
    async (request, reply) => {
      const board = (request as any).board;
      const scene = await loadScene(board.id, request.user!.org_id);

      if (!scene) {
        return reply.send({
          data: { elements: [], appState: {}, files: {} },
        });
      }

      return reply.send({ data: scene });
    },
  );

  // PUT /boards/:id/scene — Full scene save
  fastify.put<{ Params: { id: string } }>(
    '/boards/:id/scene',
    {
      preHandler: [requireAuth, requireBoardEditAccess(), requireScope('read_write')],
    },
    async (request, reply) => {
      const board = (request as any).board;
      const body = sceneBodySchema.parse(request.body);

      const sceneData: SceneData = {
        elements: body.elements,
        appState: body.appState ?? {},
        files: body.files ?? {},
      };

      await saveScene(board.id, sceneData);

      return reply.send({ data: { saved: true } });
    },
  );
}
