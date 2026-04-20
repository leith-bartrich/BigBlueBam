import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { benchSavedQueries } from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateSavedQueryInput {
  name: string;
  description?: string;
  data_source: string;
  entity: string;
  query_config: Record<string, unknown>;
}

export interface UpdateSavedQueryInput {
  name?: string;
  description?: string;
  data_source?: string;
  entity?: string;
  query_config?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notFound(msg: string): Error {
  const err = new Error(msg) as Error & { statusCode: number; code: string };
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  err.name = 'BenchError';
  return err;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listSavedQueries(orgId: string) {
  const rows = await db
    .select()
    .from(benchSavedQueries)
    .where(eq(benchSavedQueries.organization_id, orgId))
    .orderBy(desc(benchSavedQueries.updated_at))
    .limit(200);

  return { data: rows };
}

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

export async function getSavedQuery(id: string, orgId: string) {
  const [row] = await db
    .select()
    .from(benchSavedQueries)
    .where(
      and(
        eq(benchSavedQueries.id, id),
        eq(benchSavedQueries.organization_id, orgId),
      ),
    )
    .limit(1);

  if (!row) throw notFound('Saved query not found');
  return row;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createSavedQuery(
  input: CreateSavedQueryInput,
  orgId: string,
  userId: string,
) {
  const [row] = await db
    .insert(benchSavedQueries)
    .values({
      organization_id: orgId,
      name: input.name,
      description: input.description,
      data_source: input.data_source,
      entity: input.entity,
      query_config: input.query_config,
      created_by: userId,
    })
    .returning();

  return row!;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateSavedQuery(
  id: string,
  orgId: string,
  input: UpdateSavedQueryInput,
) {
  const [row] = await db
    .update(benchSavedQueries)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.data_source !== undefined ? { data_source: input.data_source } : {}),
      ...(input.entity !== undefined ? { entity: input.entity } : {}),
      ...(input.query_config !== undefined ? { query_config: input.query_config } : {}),
      updated_at: new Date(),
    })
    .where(
      and(
        eq(benchSavedQueries.id, id),
        eq(benchSavedQueries.organization_id, orgId),
      ),
    )
    .returning();

  if (!row) throw notFound('Saved query not found');
  return row;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteSavedQuery(id: string, orgId: string) {
  const [row] = await db
    .delete(benchSavedQueries)
    .where(
      and(
        eq(benchSavedQueries.id, id),
        eq(benchSavedQueries.organization_id, orgId),
      ),
    )
    .returning({ id: benchSavedQueries.id });

  if (!row) throw notFound('Saved query not found');
  return row;
}
