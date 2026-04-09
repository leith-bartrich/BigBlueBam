import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boards, boardCollaborators, boardChatMessages, users } from '../db/schema/index.js';
import { requireAuth } from '../plugins/auth.js';

const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});

/**
 * Verify the user can access the board (org match + collaborator for private).
 * Returns the board row or null.
 */
async function verifyBoardAccess(
  boardId: string,
  userId: string,
  orgId: string,
): Promise<{ id: string; organization_id: string; visibility: string } | null> {
  const [board] = await db
    .select({
      id: boards.id,
      organization_id: boards.organization_id,
      visibility: boards.visibility,
    })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  if (!board || board.organization_id !== orgId) return null;

  if (board.visibility === 'private') {
    const [collaborator] = await db
      .select({ id: boardCollaborators.id })
      .from(boardCollaborators)
      .where(
        and(
          eq(boardCollaborators.board_id, boardId),
          eq(boardCollaborators.user_id, userId),
        ),
      )
      .limit(1);
    if (!collaborator) return null;
  }

  return board;
}

export default async function chatRoutes(fastify: FastifyInstance) {
  // GET /v1/boards/:id/chat — list chat messages for a board
  fastify.get(
    '/v1/boards/:id/chat',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id: boardId } = request.params as { id: string };
      const user = request.user!;

      const board = await verifyBoardAccess(boardId, user.id, user.org_id);
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

      const messages = await db
        .select({
          id: boardChatMessages.id,
          board_id: boardChatMessages.board_id,
          author_id: boardChatMessages.author_id,
          author_name: users.display_name,
          body: boardChatMessages.body,
          created_at: boardChatMessages.created_at,
        })
        .from(boardChatMessages)
        .innerJoin(users, eq(boardChatMessages.author_id, users.id))
        .where(eq(boardChatMessages.board_id, boardId))
        .orderBy(boardChatMessages.created_at)
        .limit(200);

      return reply.send({ data: messages });
    },
  );

  // POST /v1/boards/:id/chat — send a chat message
  fastify.post(
    '/v1/boards/:id/chat',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id: boardId } = request.params as { id: string };
      const user = request.user!;
      const { body } = sendMessageSchema.parse(request.body);

      const board = await verifyBoardAccess(boardId, user.id, user.org_id);
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

      const [message] = await db
        .insert(boardChatMessages)
        .values({
          board_id: boardId,
          author_id: user.id,
          body,
        })
        .returning();

      return reply.status(201).send({
        data: {
          id: message.id,
          board_id: message.board_id,
          author_id: message.author_id,
          author_name: user.display_name,
          body: message.body,
          created_at: message.created_at,
        },
      });
    },
  );
}
