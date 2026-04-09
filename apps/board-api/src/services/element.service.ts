import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boardElements } from '../db/schema/index.js';

export async function getElements(boardId: string) {
  return await db
    .select()
    .from(boardElements)
    .where(eq(boardElements.board_id, boardId));
}

export async function getStickies(boardId: string) {
  return await db
    .select()
    .from(boardElements)
    .where(
      and(
        eq(boardElements.board_id, boardId),
        eq(boardElements.element_type, 'sticky'),
      ),
    );
}

export async function getFrames(boardId: string) {
  const frames = await db
    .select()
    .from(boardElements)
    .where(
      and(
        eq(boardElements.board_id, boardId),
        eq(boardElements.element_type, 'frame'),
      ),
    );

  const result = [];
  for (const frame of frames) {
    const children = await db
      .select()
      .from(boardElements)
      .where(
        and(
          eq(boardElements.board_id, boardId),
          eq(boardElements.frame_id, frame.id),
        ),
      );

    result.push({ ...frame, children });
  }

  return result;
}
