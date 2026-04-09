import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { requireBoardAccess } from '../middleware/authorize.js';
import * as elementService from '../services/element.service.js';

export default async function elementRoutes(fastify: FastifyInstance) {
  // GET /boards/:id/elements - All elements with positions, text, types
  fastify.get<{ Params: { id: string } }>(
    '/boards/:id/elements',
    { preHandler: [requireAuth, requireBoardAccess()] },
    async (request, reply) => {
      const elements = await elementService.getElements((request as any).board.id);
      return reply.send({ data: elements });
    },
  );

  // GET /boards/:id/elements/stickies - Sticky notes only
  fastify.get<{ Params: { id: string } }>(
    '/boards/:id/elements/stickies',
    { preHandler: [requireAuth, requireBoardAccess()] },
    async (request, reply) => {
      const stickies = await elementService.getStickies((request as any).board.id);
      return reply.send({ data: stickies });
    },
  );

  // GET /boards/:id/elements/frames - Frames with contained elements
  fastify.get<{ Params: { id: string } }>(
    '/boards/:id/elements/frames',
    { preHandler: [requireAuth, requireBoardAccess()] },
    async (request, reply) => {
      const frames = await elementService.getFrames((request as any).board.id);
      return reply.send({ data: frames });
    },
  );
}
