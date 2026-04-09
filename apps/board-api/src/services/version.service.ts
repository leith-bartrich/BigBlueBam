import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boards, boardVersions } from '../db/schema/index.js';

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

export async function listVersions(boardId: string) {
  return await db
    .select({
      id: boardVersions.id,
      board_id: boardVersions.board_id,
      version_number: boardVersions.version_number,
      name: boardVersions.name,
      thumbnail_url: boardVersions.thumbnail_url,
      created_by: boardVersions.created_by,
      created_at: boardVersions.created_at,
    })
    .from(boardVersions)
    .where(eq(boardVersions.board_id, boardId))
    .orderBy(desc(boardVersions.version_number));
}

export async function createVersion(
  boardId: string,
  name: string | undefined,
  userId: string,
  orgId: string,
) {
  const [board] = await db
    .select({ yjs_state: boards.yjs_state })
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.organization_id, orgId)))
    .limit(1);

  if (!board) throw new BoardError('NOT_FOUND', 'Board not found', 404);

  const [maxVersion]: any[] = await db.execute(sql`
    SELECT COALESCE(MAX(version_number), 0)::int AS max_ver
    FROM board_versions
    WHERE board_id = ${boardId}
  `);

  const nextNumber = (maxVersion?.max_ver ?? 0) + 1;

  const [version] = await db
    .insert(boardVersions)
    .values({
      board_id: boardId,
      version_number: nextNumber,
      name: name ?? null,
      yjs_state: board.yjs_state,
      created_by: userId,
    })
    .returning();

  return version!;
}

export async function restoreVersion(
  boardId: string,
  versionId: string,
  userId: string,
) {
  const [version] = await db
    .select()
    .from(boardVersions)
    .where(
      and(
        eq(boardVersions.id, versionId),
        eq(boardVersions.board_id, boardId),
      ),
    )
    .limit(1);

  if (!version) throw new BoardError('NOT_FOUND', 'Version not found', 404);

  const [board] = await db
    .update(boards)
    .set({
      yjs_state: version.yjs_state,
      updated_at: new Date(),
      updated_by: userId,
    })
    .where(eq(boards.id, boardId))
    .returning();

  return board!;
}
