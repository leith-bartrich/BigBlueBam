import { eq, and, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { beaconLinks, beaconEntries } from '../db/schema/index.js';

export async function createLink(
  sourceId: string,
  targetId: string,
  linkType: 'RelatedTo' | 'Supersedes' | 'DependsOn' | 'ConflictsWith' | 'SeeAlso',
  userId: string,
  orgId: string,
) {
  // Verify both beacons exist and belong to the same org
  const [source] = await db
    .select({ org: beaconEntries.organization_id })
    .from(beaconEntries)
    .where(eq(beaconEntries.id, sourceId))
    .limit(1);
  const [target] = await db
    .select({ org: beaconEntries.organization_id })
    .from(beaconEntries)
    .where(eq(beaconEntries.id, targetId))
    .limit(1);

  if (!source || !target || source.org !== orgId || target.org !== orgId) {
    return null; // treated as not-found by route
  }

  const [link] = await db
    .insert(beaconLinks)
    .values({
      source_id: sourceId,
      target_id: targetId,
      link_type: linkType,
      created_by: userId,
    })
    .onConflictDoNothing({
      target: [beaconLinks.source_id, beaconLinks.target_id, beaconLinks.link_type],
    })
    .returning();

  return link ?? null;
}

export async function removeLink(linkId: string, beaconId: string) {
  const [deleted] = await db
    .delete(beaconLinks)
    .where(
      and(
        eq(beaconLinks.id, linkId),
        or(eq(beaconLinks.source_id, beaconId), eq(beaconLinks.target_id, beaconId)),
      ),
    )
    .returning();

  return deleted ?? null;
}

/**
 * Get all links for a beacon (both as source and target).
 */
export async function getLinks(beaconId: string) {
  const links = await db
    .select()
    .from(beaconLinks)
    .where(
      or(
        eq(beaconLinks.source_id, beaconId),
        eq(beaconLinks.target_id, beaconId),
      ),
    );

  return links;
}
