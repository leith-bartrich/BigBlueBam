import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { blankFormFields, blankForms } from '../db/schema/index.js';
import { notFound, badRequest } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateFieldInput {
  field_key: string;
  label: string;
  description?: string;
  placeholder?: string;
  field_type: string;
  required?: boolean;
  min_length?: number;
  max_length?: number;
  min_value?: string;
  max_value?: string;
  regex_pattern?: string;
  options?: unknown;
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
  allowed_file_types?: string[];
  max_file_size_mb?: number;
  conditional_on_field_id?: string;
  conditional_operator?: string;
  conditional_value?: string;
  sort_order?: number;
  page_number?: number;
  column_span?: number;
  default_value?: string;
}

export interface UpdateFieldInput {
  field_key?: string;
  label?: string;
  description?: string | null;
  placeholder?: string | null;
  field_type?: string;
  required?: boolean;
  min_length?: number | null;
  max_length?: number | null;
  options?: unknown;
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string | null;
  scale_max_label?: string | null;
  sort_order?: number;
  page_number?: number;
  column_span?: number;
  default_value?: string | null;
}

// ---------------------------------------------------------------------------
// Add field to form
// ---------------------------------------------------------------------------

export async function addField(formId: string, orgId: string, input: CreateFieldInput) {
  // Verify form belongs to org
  const [form] = await db
    .select({ id: blankForms.id })
    .from(blankForms)
    .where(and(eq(blankForms.id, formId), eq(blankForms.organization_id, orgId)))
    .limit(1);

  if (!form) throw notFound('Form not found');

  // Get max sort_order
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${blankFormFields.sort_order}), -1)::int` })
    .from(blankFormFields)
    .where(eq(blankFormFields.form_id, formId));

  const [field] = await db
    .insert(blankFormFields)
    .values({
      form_id: formId,
      field_key: input.field_key,
      label: input.label,
      description: input.description,
      placeholder: input.placeholder,
      field_type: input.field_type,
      required: input.required ?? false,
      min_length: input.min_length,
      max_length: input.max_length,
      options: input.options,
      scale_min: input.scale_min,
      scale_max: input.scale_max,
      scale_min_label: input.scale_min_label,
      scale_max_label: input.scale_max_label,
      allowed_file_types: input.allowed_file_types,
      max_file_size_mb: input.max_file_size_mb,
      conditional_on_field_id: input.conditional_on_field_id,
      conditional_operator: input.conditional_operator,
      conditional_value: input.conditional_value,
      sort_order: input.sort_order ?? (maxSort?.max ?? 0) + 1,
      page_number: input.page_number ?? 1,
      column_span: input.column_span ?? 1,
      default_value: input.default_value,
    })
    .returning();

  return field!;
}

// ---------------------------------------------------------------------------
// Update field
// ---------------------------------------------------------------------------

export async function updateField(fieldId: string, input: UpdateFieldInput) {
  const updateData: Record<string, unknown> = { updated_at: new Date() };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) updateData[key] = value;
  }

  const [updated] = await db
    .update(blankFormFields)
    .set(updateData)
    .where(eq(blankFormFields.id, fieldId))
    .returning();

  if (!updated) throw notFound('Field not found');
  return updated;
}

// ---------------------------------------------------------------------------
// Delete field
// ---------------------------------------------------------------------------

export async function deleteField(fieldId: string) {
  const [deleted] = await db
    .delete(blankFormFields)
    .where(eq(blankFormFields.id, fieldId))
    .returning({ id: blankFormFields.id });

  if (!deleted) throw notFound('Field not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Reorder fields
// ---------------------------------------------------------------------------

export async function reorderFields(formId: string, orgId: string, fieldOrders: { id: string; sort_order: number }[]) {
  // Verify form belongs to org
  const [form] = await db
    .select({ id: blankForms.id })
    .from(blankForms)
    .where(and(eq(blankForms.id, formId), eq(blankForms.organization_id, orgId)))
    .limit(1);

  if (!form) throw notFound('Form not found');

  for (const item of fieldOrders) {
    await db
      .update(blankFormFields)
      .set({ sort_order: item.sort_order, updated_at: new Date() })
      .where(and(eq(blankFormFields.id, item.id), eq(blankFormFields.form_id, formId)));
  }

  return db
    .select()
    .from(blankFormFields)
    .where(eq(blankFormFields.form_id, formId))
    .orderBy(asc(blankFormFields.page_number), asc(blankFormFields.sort_order));
}
