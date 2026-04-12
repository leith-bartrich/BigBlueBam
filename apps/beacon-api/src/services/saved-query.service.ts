/**
 * Saved query service — CRUD for persisted search query configurations.
 *
 * Per §5.5.1 (Saved Queries) of the Beacon Design Spec.
 */

import { eq, and, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { beaconSavedQueries } from '../db/schema/index.js';
import { BeaconError } from './beacon.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveQueryInput {
  name: string;
  description?: string | null;
  query_body: Record<string, unknown>;
  scope?: 'Private' | 'Project' | 'Organization';
  project_id?: string | null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Save a named query configuration.
 */
export async function saveQuery(
  data: SaveQueryInput,
  userId: string,
  orgId: string,
) {
  const [query] = await db
    .insert(beaconSavedQueries)
    .values({
      name: data.name,
      description: data.description ?? null,
      query_body: data.query_body,
      owner_id: userId,
      scope: data.scope ?? 'Private',
      project_id: data.project_id ?? null,
      organization_id: orgId,
    })
    .returning();

  return query!;
}

/**
 * List saved queries — own private queries plus shared queries in scope.
 */
export async function listQueries(
  userId: string,
  orgId: string,
  projectId?: string,
) {
  // Own private queries
  const privateCondition = and(
    eq(beaconSavedQueries.owner_id, userId),
    eq(beaconSavedQueries.scope, 'Private'),
  );

  // Shared org-wide queries in the same org
  const orgCondition = and(
    eq(beaconSavedQueries.organization_id, orgId),
    eq(beaconSavedQueries.scope, 'Organization'),
  );

  // Shared project-scoped queries
  const conditions = [privateCondition, orgCondition];
  if (projectId) {
    conditions.push(
      and(
        eq(beaconSavedQueries.project_id, projectId),
        eq(beaconSavedQueries.scope, 'Project'),
      ),
    );
  }

  const result = await db
    .select()
    .from(beaconSavedQueries)
    .where(or(...conditions));

  return result;
}

/**
 * Get a single saved query by ID.
 * Returns the query if the user owns it or if it's shared in their scope.
 */
export async function getQuery(id: string, userId: string, orgId: string) {
  const [query] = await db
    .select()
    .from(beaconSavedQueries)
    .where(eq(beaconSavedQueries.id, id))
    .limit(1);

  if (!query) return null;

  // Org isolation: never return queries from a different org
  if (query.organization_id !== orgId) return null;

  // Access control: owner can always see it; shared queries visible to anyone in scope
  if (query.owner_id !== userId && query.scope === 'Private') {
    return null;
  }

  return query;
}

/**
 * Delete a saved query. Only the owner can delete.
 */
export async function deleteQuery(id: string, userId: string, orgId: string) {
  const [query] = await db
    .select()
    .from(beaconSavedQueries)
    .where(eq(beaconSavedQueries.id, id))
    .limit(1);

  if (!query || query.organization_id !== orgId) {
    throw new BeaconError('NOT_FOUND', 'Saved query not found', 404);
  }

  if (query.owner_id !== userId) {
    throw new BeaconError('FORBIDDEN', 'Only the query owner can delete it', 403);
  }

  await db
    .delete(beaconSavedQueries)
    .where(eq(beaconSavedQueries.id, id));

  return { deleted: true };
}
