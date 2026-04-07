import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { beaconTags, beaconEntries } from '../db/schema/index.js';

/**
 * List all distinct tags in the organization (optionally scoped to a project),
 * with the count of beacons using each tag.
 */
export async function listTags(orgId: string, projectId?: string) {
  // Join beacon_tags → beacon_entries to scope by org / project
  const conditions = [eq(beaconEntries.organization_id, orgId)];
  if (projectId) {
    conditions.push(eq(beaconEntries.project_id, projectId));
  }

  const rows = await db
    .select({
      tag: beaconTags.tag,
      count: sql<number>`count(*)::int`,
    })
    .from(beaconTags)
    .innerJoin(beaconEntries, eq(beaconTags.beacon_id, beaconEntries.id))
    .where(and(...conditions))
    .groupBy(beaconTags.tag)
    .orderBy(beaconTags.tag);

  return rows;
}

/**
 * Add one or more tags to a beacon.  Duplicates are silently ignored via
 * ON CONFLICT DO NOTHING on the (beacon_id, tag) unique constraint.
 */
export async function addTags(beaconId: string, tags: string[], userId: string) {
  if (tags.length === 0) return [];

  const values = tags.map((tag) => ({
    beacon_id: beaconId,
    tag: tag.trim().toLowerCase(),
    created_by: userId,
  }));

  const inserted = await db
    .insert(beaconTags)
    .values(values)
    .onConflictDoNothing({ target: [beaconTags.beacon_id, beaconTags.tag] })
    .returning();

  return inserted;
}

/**
 * Remove a single tag from a beacon.
 */
export async function removeTag(beaconId: string, tag: string) {
  const [deleted] = await db
    .delete(beaconTags)
    .where(
      and(
        eq(beaconTags.beacon_id, beaconId),
        eq(beaconTags.tag, tag.trim().toLowerCase()),
      ),
    )
    .returning();

  return deleted ?? null;
}
