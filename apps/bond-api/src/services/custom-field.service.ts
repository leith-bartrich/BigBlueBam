import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bondCustomFieldDefinitions } from '../db/schema/index.js';
import { notFound, conflict } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateCustomFieldInput {
  entity_type: 'contact' | 'company' | 'deal';
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'url' | 'email' | 'phone' | 'boolean';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  sort_order?: number;
}

export interface UpdateCustomFieldInput {
  label?: string;
  field_type?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  sort_order?: number;
}

// ---------------------------------------------------------------------------
// List custom field definitions
// ---------------------------------------------------------------------------

export async function listCustomFieldDefinitions(
  orgId: string,
  entityType?: string,
) {
  const conditions = [eq(bondCustomFieldDefinitions.organization_id, orgId)];

  if (entityType) {
    conditions.push(eq(bondCustomFieldDefinitions.entity_type, entityType));
  }

  return db
    .select()
    .from(bondCustomFieldDefinitions)
    .where(and(...conditions))
    .orderBy(
      asc(bondCustomFieldDefinitions.entity_type),
      asc(bondCustomFieldDefinitions.sort_order),
    );
}

// ---------------------------------------------------------------------------
// Get custom field definition
// ---------------------------------------------------------------------------

export async function getCustomFieldDefinition(id: string, orgId: string) {
  const [field] = await db
    .select()
    .from(bondCustomFieldDefinitions)
    .where(
      and(
        eq(bondCustomFieldDefinitions.id, id),
        eq(bondCustomFieldDefinitions.organization_id, orgId),
      ),
    )
    .limit(1);

  if (!field) throw notFound('Custom field definition not found');
  return field;
}

// ---------------------------------------------------------------------------
// Create custom field definition
// ---------------------------------------------------------------------------

export async function createCustomFieldDefinition(
  input: CreateCustomFieldInput,
  orgId: string,
) {
  try {
    const [field] = await db
      .insert(bondCustomFieldDefinitions)
      .values({
        organization_id: orgId,
        entity_type: input.entity_type,
        field_key: input.field_key,
        label: input.label,
        field_type: input.field_type,
        options: input.options ?? null,
        required: input.required ?? false,
        sort_order: input.sort_order ?? 0,
      })
      .returning();

    return field!;
  } catch (err: any) {
    if (err.code === '23505') {
      throw conflict(
        `A custom field with key "${input.field_key}" already exists for ${input.entity_type}`,
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Update custom field definition
// ---------------------------------------------------------------------------

export async function updateCustomFieldDefinition(
  id: string,
  orgId: string,
  input: UpdateCustomFieldInput,
) {
  const updates: Record<string, unknown> = {};
  if (input.label !== undefined) updates.label = input.label;
  if (input.field_type !== undefined) updates.field_type = input.field_type;
  if (input.options !== undefined) updates.options = input.options;
  if (input.required !== undefined) updates.required = input.required;
  if (input.sort_order !== undefined) updates.sort_order = input.sort_order;

  const [updated] = await db
    .update(bondCustomFieldDefinitions)
    .set(updates)
    .where(
      and(
        eq(bondCustomFieldDefinitions.id, id),
        eq(bondCustomFieldDefinitions.organization_id, orgId),
      ),
    )
    .returning();

  if (!updated) throw notFound('Custom field definition not found');
  return updated;
}

// ---------------------------------------------------------------------------
// Delete custom field definition
// ---------------------------------------------------------------------------

export async function deleteCustomFieldDefinition(id: string, orgId: string) {
  const [deleted] = await db
    .delete(bondCustomFieldDefinitions)
    .where(
      and(
        eq(bondCustomFieldDefinitions.id, id),
        eq(bondCustomFieldDefinitions.organization_id, orgId),
      ),
    )
    .returning({ id: bondCustomFieldDefinitions.id });

  if (!deleted) throw notFound('Custom field definition not found');
  return deleted;
}
