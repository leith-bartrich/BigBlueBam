import { eq, and, or, isNull, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { briefTemplates } from '../db/schema/index.js';
import { sanitizeHtml } from '../lib/sanitize.js';

export class TemplateError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'TemplateError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function listTemplates(orgId: string) {
  // Return system templates (org_id IS NULL) plus org-specific templates
  const templates = await db
    .select()
    .from(briefTemplates)
    .where(
      or(
        isNull(briefTemplates.org_id),
        eq(briefTemplates.org_id, orgId),
      ),
    )
    .orderBy(asc(briefTemplates.sort_order), asc(briefTemplates.name));

  // Strip yjs_state from list responses for size
  return templates.map((t) => ({
    ...t,
    yjs_state: undefined,
  }));
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  yjs_state?: Buffer | null;
  html_preview?: string | null;
  sort_order?: number;
}

export async function createTemplate(
  data: CreateTemplateInput,
  userId: string,
  orgId: string,
) {
  const [template] = await db
    .insert(briefTemplates)
    .values({
      org_id: orgId,
      name: data.name,
      description: data.description ?? null,
      icon: data.icon ?? null,
      category: data.category ?? null,
      yjs_state: data.yjs_state ?? null,
      html_preview: data.html_preview ? sanitizeHtml(data.html_preview) : null,
      sort_order: data.sort_order ?? 0,
      created_by: userId,
    })
    .returning();

  return template!;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  yjs_state?: Buffer | null;
  html_preview?: string | null;
  sort_order?: number;
}

export async function updateTemplate(
  id: string,
  data: UpdateTemplateInput,
  orgId: string,
) {
  const [existing] = await db
    .select()
    .from(briefTemplates)
    .where(and(eq(briefTemplates.id, id), eq(briefTemplates.org_id, orgId)))
    .limit(1);

  if (!existing) throw new TemplateError('NOT_FOUND', 'Template not found', 404);

  const updateValues: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (data.name !== undefined) updateValues.name = data.name;
  if (data.description !== undefined) updateValues.description = data.description;
  if (data.icon !== undefined) updateValues.icon = data.icon;
  if (data.category !== undefined) updateValues.category = data.category;
  if (data.yjs_state !== undefined) updateValues.yjs_state = data.yjs_state;
  if (data.html_preview !== undefined) updateValues.html_preview = data.html_preview ? sanitizeHtml(data.html_preview) : data.html_preview;
  if (data.sort_order !== undefined) updateValues.sort_order = data.sort_order;

  const [template] = await db
    .update(briefTemplates)
    .set(updateValues)
    .where(eq(briefTemplates.id, id))
    .returning();

  return template!;
}

export async function deleteTemplate(id: string, orgId: string) {
  const [existing] = await db
    .select()
    .from(briefTemplates)
    .where(and(eq(briefTemplates.id, id), eq(briefTemplates.org_id, orgId)))
    .limit(1);

  if (!existing) throw new TemplateError('NOT_FOUND', 'Template not found', 404);

  // Don't allow deleting system templates
  if (existing.org_id === null) {
    throw new TemplateError('FORBIDDEN', 'Cannot delete system templates', 403);
  }

  const [deleted] = await db
    .delete(briefTemplates)
    .where(eq(briefTemplates.id, id))
    .returning();

  return deleted!;
}
