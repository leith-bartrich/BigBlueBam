import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boardChatMessages, users } from '../db/schema/index.js';

export async function getMessages(boardId: string, limit = 100) {
  const rows = await db
    .select({
      id: boardChatMessages.id,
      board_id: boardChatMessages.board_id,
      author_id: boardChatMessages.author_id,
      body: boardChatMessages.body,
      created_at: boardChatMessages.created_at,
      display_name: users.display_name,
      avatar_url: users.avatar_url,
    })
    .from(boardChatMessages)
    .innerJoin(users, eq(boardChatMessages.author_id, users.id))
    .where(eq(boardChatMessages.board_id, boardId))
    .orderBy(desc(boardChatMessages.created_at))
    .limit(Math.min(limit, 100));

  // Return in chronological order
  return rows.reverse();
}

export async function sendMessage(boardId: string, authorId: string, body: string) {
  const [message] = await db
    .insert(boardChatMessages)
    .values({
      board_id: boardId,
      author_id: authorId,
      body,
    })
    .returning();

  // Fetch author info to include in response
  const [author] = await db
    .select({ display_name: users.display_name, avatar_url: users.avatar_url })
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);

  return {
    ...message!,
    display_name: author?.display_name ?? null,
    avatar_url: author?.avatar_url ?? null,
  };
}
