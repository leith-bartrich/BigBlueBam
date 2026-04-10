import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireBoardAccess, requireBoardEditAccess } from '../middleware/authorize.js';
import * as elementService from '../services/element.service.js';
import { loadScene, saveScene, type SceneData } from '../ws/persistence.js';

// ---------------------------------------------------------------------------
// Schemas for write endpoints
// ---------------------------------------------------------------------------

const createStickySchema = z.object({
  text: z.string().min(1).max(5000),
  x: z.number().default(100),
  y: z.number().default(100),
  width: z.number().min(10).max(2000).default(200),
  height: z.number().min(10).max(2000).default(200),
  color: z.string().max(30).default('#FFEB3B'),
});

const createTextSchema = z.object({
  text: z.string().min(1).max(10000),
  x: z.number().default(100),
  y: z.number().default(100),
  font_size: z.number().min(8).max(200).default(20),
  color: z.string().max(30).default('#000000'),
});

const exportSchema = z.object({
  format: z.enum(['json', 'svg', 'png']).default('json'),
});

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

  // -----------------------------------------------------------------------
  // Write endpoints — create elements on the canvas
  // -----------------------------------------------------------------------

  // POST /boards/:id/elements/sticky — Create a sticky note
  fastify.post<{ Params: { id: string } }>(
    '/boards/:id/elements/sticky',
    {
      preHandler: [requireAuth, requireBoardEditAccess(), requireScope('read_write')],
    },
    async (request, reply) => {
      const board = (request as any).board;
      const body = createStickySchema.parse(request.body);

      const elementId = crypto.randomUUID();

      // Build an Excalidraw-compatible sticky note element.
      // Excalidraw doesn't have a native "sticky" type, so we use a
      // rectangle with a background fill to emulate one, plus a bound
      // text element for the label.
      const stickyRect: Record<string, unknown> = {
        id: elementId,
        type: 'rectangle',
        x: body.x,
        y: body.y,
        width: body.width,
        height: body.height,
        angle: 0,
        strokeColor: '#000000',
        backgroundColor: body.color,
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        roundness: { type: 3 },
        isDeleted: false,
        boundElements: [{ id: `${elementId}-text`, type: 'text' }],
        version: 1,
        versionNonce: Math.floor(Math.random() * 2147483647),
      };

      const stickyText: Record<string, unknown> = {
        id: `${elementId}-text`,
        type: 'text',
        x: body.x + 10,
        y: body.y + 10,
        width: body.width - 20,
        height: body.height - 20,
        angle: 0,
        strokeColor: '#000000',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        text: body.text,
        fontSize: 16,
        fontFamily: 1,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: elementId,
        originalText: body.text,
        isDeleted: false,
        version: 1,
        versionNonce: Math.floor(Math.random() * 2147483647),
      };

      // Load current scene, append the new elements, and save back
      const scene = await loadScene(board.id, request.user!.org_id);
      const currentElements = scene?.elements ?? [];

      const updatedScene: SceneData = {
        elements: [...(currentElements as unknown[]), stickyRect, stickyText],
        appState: scene?.appState ?? {},
        files: scene?.files ?? {},
      };

      // saveScene triggers element snapshot sync internally
      await saveScene(board.id, request.user!.org_id, updatedScene);

      return reply.status(201).send({
        data: {
          element_id: elementId,
          text_element_id: `${elementId}-text`,
          type: 'sticky',
          text: body.text,
          x: body.x,
          y: body.y,
          width: body.width,
          height: body.height,
          color: body.color,
        },
      });
    },
  );

  // POST /boards/:id/elements/text — Create a text element
  fastify.post<{ Params: { id: string } }>(
    '/boards/:id/elements/text',
    {
      preHandler: [requireAuth, requireBoardEditAccess(), requireScope('read_write')],
    },
    async (request, reply) => {
      const board = (request as any).board;
      const body = createTextSchema.parse(request.body);

      const elementId = crypto.randomUUID();

      const textElement: Record<string, unknown> = {
        id: elementId,
        type: 'text',
        x: body.x,
        y: body.y,
        width: 0, // Excalidraw auto-sizes text width
        height: 0,
        angle: 0,
        strokeColor: body.color,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        text: body.text,
        fontSize: body.font_size,
        fontFamily: 1,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: null,
        originalText: body.text,
        isDeleted: false,
        version: 1,
        versionNonce: Math.floor(Math.random() * 2147483647),
      };

      // Load current scene, append the new element, and save back
      const scene = await loadScene(board.id, request.user!.org_id);
      const currentElements = scene?.elements ?? [];

      const updatedScene: SceneData = {
        elements: [...(currentElements as unknown[]), textElement],
        appState: scene?.appState ?? {},
        files: scene?.files ?? {},
      };

      await saveScene(board.id, request.user!.org_id, updatedScene);

      return reply.status(201).send({
        data: {
          element_id: elementId,
          type: 'text',
          text: body.text,
          x: body.x,
          y: body.y,
          font_size: body.font_size,
          color: body.color,
        },
      });
    },
  );

  // -----------------------------------------------------------------------
  // Export endpoint
  // -----------------------------------------------------------------------

  // POST /boards/:id/export — Export the board scene
  fastify.post<{ Params: { id: string } }>(
    '/boards/:id/export',
    { preHandler: [requireAuth, requireBoardAccess()] },
    async (request, reply) => {
      const board = (request as any).board;
      const body = exportSchema.parse(request.body ?? {});

      const scene = await loadScene(board.id, request.user!.org_id);

      if (!scene || !scene.elements || (scene.elements as unknown[]).length === 0) {
        return reply.send({
          data: {
            format: body.format,
            board_id: board.id,
            board_name: board.name,
            element_count: 0,
            scene: { elements: [], appState: {}, files: {} },
            note: 'Board has no elements.',
          },
        });
      }

      if (body.format === 'json') {
        return reply.send({
          data: {
            format: 'json',
            board_id: board.id,
            board_name: board.name,
            element_count: (scene.elements as unknown[]).length,
            scene,
            note: 'Raw Excalidraw JSON. SVG/PNG rendering requires client-side rendering via @excalidraw/utils exportToSvg/exportToBlob.',
          },
        });
      }

      // SVG and PNG formats require client-side rendering (Excalidraw does not
      // support headless server-side export without a browser environment).
      // Return the JSON with a message indicating the limitation.
      return reply.send({
        data: {
          format: body.format,
          board_id: board.id,
          board_name: board.name,
          element_count: (scene.elements as unknown[]).length,
          scene,
          note: `Export format '${body.format}' requires client-side rendering. Use @excalidraw/utils exportToSvg or exportToBlob with the returned scene data.`,
        },
      });
    },
  );
}
