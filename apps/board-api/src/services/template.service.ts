import { eq, or, isNull, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boardTemplates, boards } from '../db/schema/index.js';

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

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  board_id?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  sort_order?: number;
}

export async function listTemplates(orgId: string) {
  return await db
    .select()
    .from(boardTemplates)
    .where(or(isNull(boardTemplates.org_id), eq(boardTemplates.org_id, orgId)))
    .orderBy(asc(boardTemplates.sort_order), asc(boardTemplates.name));
}

export async function createTemplate(data: CreateTemplateInput, userId: string, orgId: string) {
  let yjsState: Buffer | null = null;

  if (data.board_id) {
    const [board] = await db
      .select({ yjs_state: boards.yjs_state, organization_id: boards.organization_id })
      .from(boards)
      .where(eq(boards.id, data.board_id))
      .limit(1);
    if (!board || board.organization_id !== orgId) {
      throw new BoardError('NOT_FOUND', 'Board not found', 404);
    }
    yjsState = board.yjs_state;
  }

  const [template] = await db
    .insert(boardTemplates)
    .values({
      org_id: orgId,
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      icon: data.icon ?? null,
      yjs_state: yjsState,
      created_by: userId,
    })
    .returning();

  return template!;
}

export async function updateTemplate(id: string, data: UpdateTemplateInput, orgId: string) {
  const [existing] = await db
    .select()
    .from(boardTemplates)
    .where(eq(boardTemplates.id, id))
    .limit(1);

  if (!existing) throw new BoardError('NOT_FOUND', 'Template not found', 404);
  if (existing.org_id === null) throw new BoardError('FORBIDDEN', 'Cannot modify system templates', 403);
  if (existing.org_id !== orgId) throw new BoardError('NOT_FOUND', 'Template not found', 404);

  const updateValues: Record<string, unknown> = {};
  if (data.name !== undefined) updateValues.name = data.name;
  if (data.description !== undefined) updateValues.description = data.description;
  if (data.category !== undefined) updateValues.category = data.category;
  if (data.icon !== undefined) updateValues.icon = data.icon;
  if (data.sort_order !== undefined) updateValues.sort_order = data.sort_order;

  const [template] = await db
    .update(boardTemplates)
    .set(updateValues)
    .where(eq(boardTemplates.id, id))
    .returning();

  return template!;
}

export async function deleteTemplate(id: string, orgId: string) {
  const [existing] = await db
    .select()
    .from(boardTemplates)
    .where(eq(boardTemplates.id, id))
    .limit(1);

  if (!existing) throw new BoardError('NOT_FOUND', 'Template not found', 404);
  if (existing.org_id === null) throw new BoardError('FORBIDDEN', 'Cannot delete system templates', 403);
  if (existing.org_id !== orgId) throw new BoardError('NOT_FOUND', 'Template not found', 404);

  await db.delete(boardTemplates).where(eq(boardTemplates.id, id));
  return { deleted: true };
}
