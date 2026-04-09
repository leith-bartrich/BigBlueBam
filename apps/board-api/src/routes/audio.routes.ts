import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boards, boardCollaborators } from '../db/schema/index.js';
import { requireAuth } from '../plugins/auth.js';
import { generateBoardAudioToken } from '../services/livekit.service.js';

export default async function audioRoutes(fastify: FastifyInstance) {
  // POST /v1/boards/:id/audio/token — get a LiveKit JWT for the board's audio room
  fastify.post(
    '/v1/boards/:id/audio/token',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id: boardId } = request.params as { id: string };
      const user = request.user!;

      // Verify the board exists and belongs to the user's org
      const [board] = await db
        .select({ id: boards.id, organization_id: boards.organization_id, visibility: boards.visibility })
        .from(boards)
        .where(eq(boards.id, boardId))
        .limit(1);

      if (!board) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Board not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Check org membership
      if (board.organization_id !== user.org_id) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this board',
            details: [],
            request_id: request.id,
          },
        });
      }

      // For private boards, check collaborator access
      if (board.visibility === 'private') {
        const [collaborator] = await db
          .select({ id: boardCollaborators.id })
          .from(boardCollaborators)
          .where(
            and(
              eq(boardCollaborators.board_id, boardId),
              eq(boardCollaborators.user_id, user.id),
            ),
          )
          .limit(1);

        if (!collaborator) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have access to this private board',
              details: [],
              request_id: request.id,
            },
          });
        }
      }

      const result = await generateBoardAudioToken(boardId, user.id, user.display_name);

      return reply.status(200).send({
        data: {
          token: result.token,
          room_name: result.roomName,
          ws_url: result.wsUrl,
        },
      });
    },
  );
}
