import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { beaconVersions } from '../db/schema/index.js';

export async function listVersions(beaconId: string) {
  const versions = await db
    .select()
    .from(beaconVersions)
    .where(eq(beaconVersions.beacon_id, beaconId))
    .orderBy(asc(beaconVersions.version));

  return versions;
}

export async function getVersion(beaconId: string, versionNumber: number) {
  const [version] = await db
    .select()
    .from(beaconVersions)
    .where(
      and(
        eq(beaconVersions.beacon_id, beaconId),
        eq(beaconVersions.version, versionNumber),
      ),
    )
    .limit(1);

  return version ?? null;
}
