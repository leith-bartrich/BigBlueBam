import { eq, and, or, isNull, asc, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boardTemplates, boards, boardCollaborators, projectMembers } from '../db/schema/index.js';
import { createBoard } from './board.service.js';

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

export async function listTemplates(orgId: string, category?: string) {
  const conditions: SQL[] = [
    or(isNull(boardTemplates.org_id), eq(boardTemplates.org_id, orgId))!,
  ];
  if (category) {
    conditions.push(eq(boardTemplates.category, category));
  }
  return await db
    .select()
    .from(boardTemplates)
    .where(and(...conditions))
    .orderBy(asc(boardTemplates.sort_order), asc(boardTemplates.name));
}

export async function createTemplate(data: CreateTemplateInput, userId: string, orgId: string) {
  let yjsState: Buffer | null = null;

  if (data.board_id) {
    const [board] = await db
      .select({
        yjs_state: boards.yjs_state,
        organization_id: boards.organization_id,
        visibility: boards.visibility,
        created_by: boards.created_by,
        project_id: boards.project_id,
      })
      .from(boards)
      .where(eq(boards.id, data.board_id))
      .limit(1);
    if (!board || board.organization_id !== orgId) {
      throw new BoardError('NOT_FOUND', 'Board not found', 404);
    }

    // Enforce visibility: user must have access to the source board
    if (board.visibility === 'private') {
      if (board.created_by !== userId) {
        const [collab] = await db
          .select({ id: boardCollaborators.id })
          .from(boardCollaborators)
          .where(
            and(
              eq(boardCollaborators.board_id, data.board_id),
              eq(boardCollaborators.user_id, userId),
            ),
          )
          .limit(1);
        if (!collab) {
          throw new BoardError('NOT_FOUND', 'Board not found', 404);
        }
      }
    } else if (board.visibility === 'project') {
      if (board.created_by !== userId) {
        let hasAccess = false;
        if (board.project_id) {
          const [membership] = await db
            .select({ id: projectMembers.id })
            .from(projectMembers)
            .where(
              and(
                eq(projectMembers.project_id, board.project_id),
                eq(projectMembers.user_id, userId),
              ),
            )
            .limit(1);
          if (membership) hasAccess = true;
        }
        if (!hasAccess) {
          const [collab] = await db
            .select({ id: boardCollaborators.id })
            .from(boardCollaborators)
            .where(
              and(
                eq(boardCollaborators.board_id, data.board_id),
                eq(boardCollaborators.user_id, userId),
              ),
            )
            .limit(1);
          if (collab) hasAccess = true;
        }
        if (!hasAccess) {
          throw new BoardError('NOT_FOUND', 'Board not found', 404);
        }
      }
    }
    // 'organization' visibility: all org members can access (already verified org match above)

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

export async function instantiateTemplate(
  templateId: string,
  opts: { name?: string; project_id?: string },
  userId: string,
  orgId: string,
) {
  const [template] = await db
    .select()
    .from(boardTemplates)
    .where(eq(boardTemplates.id, templateId))
    .limit(1);

  if (!template) throw new BoardError('NOT_FOUND', 'Template not found', 404);

  // System templates (org_id NULL) are available to everyone.
  // Org templates must belong to the same org.
  if (template.org_id !== null && template.org_id !== orgId) {
    throw new BoardError('NOT_FOUND', 'Template not found', 404);
  }

  const boardName = opts.name || template.name;
  return createBoard(
    {
      name: boardName,
      description: template.description,
      template_id: templateId,
      project_id: opts.project_id ?? null,
    },
    userId,
    orgId,
  );
}
