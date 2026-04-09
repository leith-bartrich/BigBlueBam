import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boardTaskLinks, boardElements, boards, tasks } from '../db/schema/index.js';
import { env } from '../env.js';

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

export interface PromoteElementInput {
  element_ids: string[];
  project_id: string;
  phase_id?: string;
}

export async function getLinks(boardId: string) {
  return await db
    .select({
      id: boardTaskLinks.id,
      board_id: boardTaskLinks.board_id,
      element_id: boardTaskLinks.element_id,
      task_id: boardTaskLinks.task_id,
      created_by: boardTaskLinks.created_by,
      created_at: boardTaskLinks.created_at,
      task_title: tasks.title,
    })
    .from(boardTaskLinks)
    .leftJoin(tasks, eq(boardTaskLinks.task_id, tasks.id))
    .where(eq(boardTaskLinks.board_id, boardId));
}

export async function deleteLink(linkId: string, orgId: string) {
  const [link] = await db
    .select({ id: boardTaskLinks.id, board_id: boardTaskLinks.board_id })
    .from(boardTaskLinks)
    .where(eq(boardTaskLinks.id, linkId))
    .limit(1);

  if (!link) throw new BoardError('NOT_FOUND', 'Link not found', 404);

  const [board] = await db
    .select({ organization_id: boards.organization_id })
    .from(boards)
    .where(eq(boards.id, link.board_id))
    .limit(1);

  if (!board || board.organization_id !== orgId) {
    throw new BoardError('NOT_FOUND', 'Link not found', 404);
  }

  await db.delete(boardTaskLinks).where(eq(boardTaskLinks.id, linkId));
  return { deleted: true };
}

export async function promoteElements(
  boardId: string,
  data: PromoteElementInput,
  userId: string,
  orgId: string,
) {
  const elements = await db
    .select()
    .from(boardElements)
    .where(
      and(
        eq(boardElements.board_id, boardId),
        eq(boardElements.element_type, 'sticky'),
      ),
    );

  const toPromote = elements.filter((el) => data.element_ids.includes(el.id));
  if (toPromote.length === 0) {
    throw new BoardError('BAD_REQUEST', 'No matching sticky elements found', 400);
  }

  const results: Array<{ element_id: string; task_id: string | null; error?: string }> = [];

  for (const el of toPromote) {
    try {
      const response = await fetch(`${env.BBB_API_INTERNAL_URL}/v1/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service': 'board-api',
          'X-Org-Id': orgId,
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          title: el.text_content || 'Untitled (from board)',
          project_id: data.project_id,
          phase_id: data.phase_id,
        }),
      });

      if (!response.ok) {
        results.push({ element_id: el.id, task_id: null, error: 'Failed to create task' });
        continue;
      }

      const taskData = (await response.json()) as any;
      const taskId = taskData?.data?.id ?? taskData?.id;

      if (!taskId) {
        results.push({ element_id: el.id, task_id: null, error: 'No task ID returned' });
        continue;
      }

      await db.insert(boardTaskLinks).values({
        board_id: boardId,
        element_id: el.id,
        task_id: taskId,
        created_by: userId,
      });

      results.push({ element_id: el.id, task_id: taskId });
    } catch {
      results.push({ element_id: el.id, task_id: null, error: 'Internal error' });
    }
  }

  return results;
}
