import { eq } from 'drizzle-orm';
import { db as defaultDb } from '../db/index.js';
import { banterSettings } from '../db/schema/index.js';

/**
 * Simple in-memory cache for banter_settings reads.
 *
 * Mirrors the caching approach used by apps/api/src/services/org.service.ts
 * (getOrganizationCached). Banter permission checks fire on every channel
 * creation / DM creation / file upload, so a short TTL cache prevents
 * hitting Postgres for a row that almost never changes.
 *
 * TTL: 30 seconds. Short enough that admin-updated settings propagate quickly
 * across horizontally scaled instances without needing pub/sub invalidation.
 *
 * For multi-instance cache coherence, settings updates also broadcast a
 * 'settings.updated' realtime event; that channel could later be used to
 * invalidate peers' caches. For now we rely on the TTL.
 */

export type BanterSettingsRow = typeof banterSettings.$inferSelect;

type CacheEntry = {
  // `null` means "we queried and no row exists" — cache the miss too
  // so we don't hammer the DB when an org has never saved settings.
  data: BanterSettingsRow | null;
  expires: number;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

// Bound the map size to avoid unbounded growth on a long-running process.
// Orgs are typically few, but under a runaway scenario (test fuzzing, bugs)
// we clear the whole map when it crosses this threshold.
const MAX_CACHE_ENTRIES = 10_000;

export async function getBanterSettingsCached(
  orgId: string,
  db: typeof defaultDb = defaultDb,
): Promise<BanterSettingsRow | null> {
  const now = Date.now();
  const cached = cache.get(orgId);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const [row] = await db
    .select()
    .from(banterSettings)
    .where(eq(banterSettings.org_id, orgId))
    .limit(1);

  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.clear();
  }
  cache.set(orgId, { data: row ?? null, expires: now + CACHE_TTL_MS });
  return row ?? null;
}

export function invalidateBanterSettingsCache(orgId: string): void {
  cache.delete(orgId);
}

export function clearBanterSettingsCache(): void {
  cache.clear();
}
