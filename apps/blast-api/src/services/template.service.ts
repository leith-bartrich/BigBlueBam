import { eq, and, ilike, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { blastTemplates } from '../db/schema/index.js';
import { escapeLike, notFound } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateFilters {
  organization_id: string;
  template_type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  subject_template: string;
  html_body: string;
  json_design?: unknown;
  plain_text_body?: string;
  template_type?: string;
  thumbnail_url?: string;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {}

// ---------------------------------------------------------------------------
// List templates
// ---------------------------------------------------------------------------

export async function listTemplates(filters: TemplateFilters) {
  const conditions = [eq(blastTemplates.organization_id, filters.organization_id)];

  if (filters.template_type) {
    conditions.push(eq(blastTemplates.template_type, filters.template_type));
  }
  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`;
    conditions.push(ilike(blastTemplates.name, pattern));
  }

  const limit = Math.min(filters.limit ?? 50, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(blastTemplates)
      .where(and(...conditions))
      .orderBy(desc(blastTemplates.updated_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(blastTemplates)
      .where(and(...conditions)),
  ]);

  return {
    data: rows,
    total: countResult[0]?.count ?? 0,
    limit,
    offset,
  };
}

// ---------------------------------------------------------------------------
// Get template by ID
// ---------------------------------------------------------------------------

export async function getTemplate(id: string, orgId: string) {
  const [template] = await db
    .select()
    .from(blastTemplates)
    .where(and(eq(blastTemplates.id, id), eq(blastTemplates.organization_id, orgId)))
    .limit(1);

  if (!template) throw notFound('Template not found');
  return template;
}

// ---------------------------------------------------------------------------
// Create template
// ---------------------------------------------------------------------------

export async function createTemplate(
  input: CreateTemplateInput,
  orgId: string,
  userId: string,
) {
  const [template] = await db
    .insert(blastTemplates)
    .values({
      organization_id: orgId,
      name: input.name,
      description: input.description,
      subject_template: input.subject_template,
      html_body: input.html_body,
      json_design: input.json_design ?? null,
      plain_text_body: input.plain_text_body,
      template_type: input.template_type ?? 'campaign',
      thumbnail_url: input.thumbnail_url,
      created_by: userId,
      updated_by: userId,
    })
    .returning();

  return template!;
}

// ---------------------------------------------------------------------------
// Update template
// ---------------------------------------------------------------------------

export async function updateTemplate(
  id: string,
  orgId: string,
  input: UpdateTemplateInput,
  userId: string,
) {
  const [updated] = await db
    .update(blastTemplates)
    .set({
      ...input,
      updated_by: userId,
      updated_at: new Date(),
      version: sql`${blastTemplates.version} + 1`,
    })
    .where(and(eq(blastTemplates.id, id), eq(blastTemplates.organization_id, orgId)))
    .returning();

  if (!updated) throw notFound('Template not found');
  return updated;
}

// ---------------------------------------------------------------------------
// Delete template
// ---------------------------------------------------------------------------

export async function deleteTemplate(id: string, orgId: string) {
  const [deleted] = await db
    .delete(blastTemplates)
    .where(and(eq(blastTemplates.id, id), eq(blastTemplates.organization_id, orgId)))
    .returning({ id: blastTemplates.id });

  if (!deleted) throw notFound('Template not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Duplicate template
// ---------------------------------------------------------------------------

export async function duplicateTemplate(id: string, orgId: string, userId: string) {
  const original = await getTemplate(id, orgId);

  const [copy] = await db
    .insert(blastTemplates)
    .values({
      organization_id: orgId,
      name: `${original.name} (Copy)`,
      description: original.description,
      subject_template: original.subject_template,
      html_body: original.html_body,
      json_design: original.json_design,
      plain_text_body: original.plain_text_body,
      template_type: original.template_type,
      thumbnail_url: original.thumbnail_url,
      created_by: userId,
      updated_by: userId,
    })
    .returning();

  return copy!;
}

// ---------------------------------------------------------------------------
// Preview template — render with sample merge data
// ---------------------------------------------------------------------------

export async function previewTemplate(id: string, orgId: string, mergeData?: Record<string, string>) {
  const template = await getTemplate(id, orgId);

  const data = mergeData ?? {
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    'company.name': 'Acme Corp',
    'company.industry': 'Technology',
    unsubscribe_url: '#unsubscribe',
  };

  let html = template.html_body;
  let subject = template.subject_template;

  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');
    html = html.replace(regex, value);
    subject = subject.replace(regex, value);
  }

  return { subject, html, plain_text: template.plain_text_body };
}
