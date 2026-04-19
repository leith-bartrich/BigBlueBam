import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boardCollaborators, boards, users } from '../db/schema/index.js';

export class BoardError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'BoardError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface AddCollaboratorInput {
  user_id: string;
  permission?: string;
}

export interface UpdateCollaboratorInput {
  permission: string;
}

export async function listCollaborators(boardId: string) {
  return await db
    .select({
      id: boardCollaborators.id,
      board_id: boardCollaborators.board_id,
      user_id: boardCollaborators.user_id,
      permission: boardCollaborators.permission,
      created_at: boardCollaborators.created_at,
      display_name: users.display_name,
      email: users.email,
      avatar_url: users.avatar_url,
    })
    .from(boardCollaborators)
    .innerJoin(users, eq(boardCollaborators.user_id, users.id))
    .where(eq(boardCollaborators.board_id, boardId));
}

export async function addCollaborator(boardId: string, data: AddCollaboratorInput, orgId: string) {
  const [user] = await db
    .select({ id: users.id, org_id: users.org_id })
    .from(users)
    .where(eq(users.id, data.user_id))
    .limit(1);

  if (!user) throw new BoardError('NOT_FOUND', 'User not found', 404);
  if (user.org_id !== orgId) {
    throw new BoardError('BAD_REQUEST', 'User is not in the same organization', 400);
  }

  try {
    const [collab] = await db
      .insert(boardCollaborators)
      .values({
        board_id: boardId,
        user_id: data.user_id,
        permission: data.permission ?? 'edit',
      })
      .returning();
    return collab!;
  } catch (err: any) {
    if (err.code === '23505') {
      throw new BoardError('CONFLICT', 'User is already a collaborator', 409);
    }
    throw err;
  }
}

export async function updateCollaborator(collabId: string, data: UpdateCollaboratorInput, orgId: string) {
  const [existing] = await db
    .select({ id: boardCollaborators.id, board_id: boardCollaborators.board_id })
    .from(boardCollaborators)
    .where(eq(boardCollaborators.id, collabId))
    .limit(1);

  if (!existing) throw new BoardError('NOT_FOUND', 'Collaborator not found', 404);

  const [board] = await db
    .select({ organization_id: boards.organization_id })
    .from(boards)
    .where(eq(boards.id, existing.board_id))
    .limit(1);

  if (!board || board.organization_id !== orgId) {
    throw new BoardError('NOT_FOUND', 'Collaborator not found', 404);
  }

  const [collab] = await db
    .update(boardCollaborators)
    .set({ permission: data.permission })
    .where(eq(boardCollaborators.id, collabId))
    .returning();

  return collab!;
}

export async function deleteCollaborator(collabId: string, orgId: string) {
  const [existing] = await db
    .select({ id: boardCollaborators.id, board_id: boardCollaborators.board_id })
    .from(boardCollaborators)
    .where(eq(boardCollaborators.id, collabId))
    .limit(1);

  if (!existing) throw new BoardError('NOT_FOUND', 'Collaborator not found', 404);

  const [board] = await db
    .select({ organization_id: boards.organization_id })
    .from(boards)
    .where(eq(boards.id, existing.board_id))
    .limit(1);

  if (!board || board.organization_id !== orgId) {
    throw new BoardError('NOT_FOUND', 'Collaborator not found', 404);
  }

  await db.delete(boardCollaborators).where(eq(boardCollaborators.id, collabId));
  return { deleted: true };
}
