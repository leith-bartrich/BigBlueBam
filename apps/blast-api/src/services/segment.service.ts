import { eq, and, ilike, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { blastSegments, bondContacts } from '../db/schema/index.js';
import { escapeLike, notFound } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SegmentFilters {
  organization_id: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateSegmentInput {
  name: string;
  description?: string;
  filter_criteria: {
    conditions: Array<{ field: string; op: string; value: unknown }>;
    match: 'all' | 'any';
  };
}

export interface UpdateSegmentInput extends Partial<CreateSegmentInput> {}

// ---------------------------------------------------------------------------
// List segments
// ---------------------------------------------------------------------------

export async function listSegments(filters: SegmentFilters) {
  const conditions = [eq(blastSegments.organization_id, filters.organization_id)];

  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`;
    conditions.push(ilike(blastSegments.name, pattern));
  }

  const limit = Math.min(filters.limit ?? 50, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(blastSegments)
      .where(and(...conditions))
      .orderBy(desc(blastSegments.updated_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(blastSegments)
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
// Get segment
// ---------------------------------------------------------------------------

export async function getSegment(id: string, orgId: string) {
  const [segment] = await db
    .select()
    .from(blastSegments)
    .where(and(eq(blastSegments.id, id), eq(blastSegments.organization_id, orgId)))
    .limit(1);

  if (!segment) throw notFound('Segment not found');
  return segment;
}

// ---------------------------------------------------------------------------
// Create segment
// ---------------------------------------------------------------------------

export async function createSegment(
  input: CreateSegmentInput,
  orgId: string,
  userId: string,
) {
  const [segment] = await db
    .insert(blastSegments)
    .values({
      organization_id: orgId,
      name: input.name,
      description: input.description,
      filter_criteria: input.filter_criteria,
      created_by: userId,
    })
    .returning();

  return segment!;
}

// ---------------------------------------------------------------------------
// Update segment
// ---------------------------------------------------------------------------

export async function updateSegment(
  id: string,
  orgId: string,
  input: UpdateSegmentInput,
) {
  const [updated] = await db
    .update(blastSegments)
    .set({
      ...input,
      updated_at: new Date(),
    })
    .where(and(eq(blastSegments.id, id), eq(blastSegments.organization_id, orgId)))
    .returning();

  if (!updated) throw notFound('Segment not found');
  return updated;
}

// ---------------------------------------------------------------------------
// Delete segment
// ---------------------------------------------------------------------------

export async function deleteSegment(id: string, orgId: string) {
  const [deleted] = await db
    .delete(blastSegments)
    .where(and(eq(blastSegments.id, id), eq(blastSegments.organization_id, orgId)))
    .returning({ id: blastSegments.id });

  if (!deleted) throw notFound('Segment not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Recalculate segment count (queries Bond contacts)
// ---------------------------------------------------------------------------

export async function recalculateSegmentCount(id: string, orgId: string) {
  const segment = await getSegment(id, orgId);

  // Simple count based on org contacts — real implementation would apply
  // filter_criteria against bond_contacts columns and custom_fields.
  const criteria = segment.filter_criteria as {
    conditions: Array<{ field: string; op: string; value: unknown }>;
    match: string;
  };

  // Build dynamic conditions from filter_criteria
  const baseConditions = [eq(bondContacts.organization_id, orgId)];

  for (const condition of criteria.conditions ?? []) {
    if (condition.field === 'lifecycle_stage' && condition.op === 'in') {
      // Add lifecycle_stage filter
      const values = condition.value as string[];
      if (values.length > 0) {
        baseConditions.push(
          sql`${bondContacts.lifecycle_stage} = ANY(${values})`,
        );
      }
    }
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bondContacts)
    .where(and(...baseConditions));

  const count = result?.count ?? 0;

  // Update cached count
  await db
    .update(blastSegments)
    .set({
      cached_count: count,
      cached_at: new Date(),
    })
    .where(eq(blastSegments.id, id));

  return { count, cached_at: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Preview segment contacts
// ---------------------------------------------------------------------------

export async function previewSegmentContacts(id: string, orgId: string) {
  const segment = await getSegment(id, orgId);

  // Return first 50 matching contacts — simplified version
  const contacts = await db
    .select({
      id: bondContacts.id,
      first_name: bondContacts.first_name,
      last_name: bondContacts.last_name,
      email: bondContacts.email,
      lifecycle_stage: bondContacts.lifecycle_stage,
    })
    .from(bondContacts)
    .where(eq(bondContacts.organization_id, orgId))
    .limit(50);

  return { segment_id: segment.id, contacts, count: contacts.length };
}
