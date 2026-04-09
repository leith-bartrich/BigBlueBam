import { eq, and, desc, isNull, lte, or, gte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { billRates } from '../db/schema/index.js';
import { notFound } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateFilters {
  organization_id: string;
  project_id?: string;
  user_id?: string;
}

export interface CreateRateInput {
  project_id?: string;
  user_id?: string;
  rate_amount: number;
  rate_type?: string;
  currency?: string;
  effective_from?: string;
  effective_to?: string;
}

export interface UpdateRateInput {
  rate_amount?: number;
  rate_type?: string;
  effective_from?: string;
  effective_to?: string;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listRates(filters: RateFilters) {
  const conditions: any[] = [eq(billRates.organization_id, filters.organization_id)];

  if (filters.project_id) conditions.push(eq(billRates.project_id, filters.project_id));
  if (filters.user_id) conditions.push(eq(billRates.user_id, filters.user_id));

  const rows = await db
    .select()
    .from(billRates)
    .where(and(...conditions))
    .orderBy(desc(billRates.created_at));

  return { data: rows };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createRate(input: CreateRateInput, orgId: string) {
  const [rate] = await db
    .insert(billRates)
    .values({
      organization_id: orgId,
      project_id: input.project_id,
      user_id: input.user_id,
      rate_amount: input.rate_amount,
      rate_type: input.rate_type ?? 'hourly',
      currency: input.currency ?? 'USD',
      effective_from: input.effective_from ?? new Date().toISOString().split('T')[0]!,
      effective_to: input.effective_to,
    })
    .returning();

  return rate!;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateRate(id: string, orgId: string, input: UpdateRateInput) {
  const [existing] = await db
    .select()
    .from(billRates)
    .where(and(eq(billRates.id, id), eq(billRates.organization_id, orgId)))
    .limit(1);

  if (!existing) throw notFound('Rate not found');

  const [updated] = await db
    .update(billRates)
    .set({
      ...input,
      rate_amount: input.rate_amount ?? existing.rate_amount,
      updated_at: new Date(),
    })
    .where(and(eq(billRates.id, id), eq(billRates.organization_id, orgId)))
    .returning();

  if (!updated) throw notFound('Rate not found');
  return updated;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteRate(id: string, orgId: string) {
  const [deleted] = await db
    .delete(billRates)
    .where(and(eq(billRates.id, id), eq(billRates.organization_id, orgId)))
    .returning({ id: billRates.id });

  if (!deleted) throw notFound('Rate not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Resolve rate (most specific match: user+project > user > project > org)
// ---------------------------------------------------------------------------

export async function resolveRate(orgId: string, projectId?: string, userId?: string, dateStr?: string) {
  const date = dateStr ?? new Date().toISOString().split('T')[0]!;

  // Build conditions for effective date range
  const dateConditions = and(
    lte(billRates.effective_from, date),
    or(isNull(billRates.effective_to), gte(billRates.effective_to, date)),
  );

  // Try user+project first
  if (userId && projectId) {
    const [rate] = await db
      .select()
      .from(billRates)
      .where(
        and(
          eq(billRates.organization_id, orgId),
          eq(billRates.project_id, projectId),
          eq(billRates.user_id, userId),
          dateConditions,
        ),
      )
      .orderBy(desc(billRates.effective_from))
      .limit(1);
    if (rate) return { data: rate, scope: 'user+project' };
  }

  // Try user-only
  if (userId) {
    const [rate] = await db
      .select()
      .from(billRates)
      .where(
        and(
          eq(billRates.organization_id, orgId),
          isNull(billRates.project_id),
          eq(billRates.user_id, userId),
          dateConditions,
        ),
      )
      .orderBy(desc(billRates.effective_from))
      .limit(1);
    if (rate) return { data: rate, scope: 'user' };
  }

  // Try project-only
  if (projectId) {
    const [rate] = await db
      .select()
      .from(billRates)
      .where(
        and(
          eq(billRates.organization_id, orgId),
          eq(billRates.project_id, projectId),
          isNull(billRates.user_id),
          dateConditions,
        ),
      )
      .orderBy(desc(billRates.effective_from))
      .limit(1);
    if (rate) return { data: rate, scope: 'project' };
  }

  // Try org default
  const [rate] = await db
    .select()
    .from(billRates)
    .where(
      and(
        eq(billRates.organization_id, orgId),
        isNull(billRates.project_id),
        isNull(billRates.user_id),
        dateConditions,
      ),
    )
    .orderBy(desc(billRates.effective_from))
    .limit(1);

  if (rate) return { data: rate, scope: 'organization' };

  return { data: null, scope: 'none' };
}
