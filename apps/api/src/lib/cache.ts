import type Redis from 'ioredis';

/**
 * Thin Redis-backed read-through cache for a handful of hot paths
 * (org settings, per-user project listings). This is intentionally NOT
 * a general-purpose caching framework — it is two targeted call sites
 * wrapped around a ~20-line helper.
 *
 * Values are JSON-serialized. Any Redis error (connection loss, timeout,
 * parse failure) falls through to the fetcher so a broken cache can
 * never break a request. Writes to the backing store should call
 * cacheInvalidate() to drop the stale key.
 */

/** Key prefix convention: `bbb:<scope>:<id>:<resource>` */
export const CACHE_KEYS = {
  orgSettings: (orgId: string) => `bbb:org:${orgId}:settings`,
  userProjects: (userId: string) => `bbb:user:${userId}:projects`,
} as const;

/**
 * Read a JSON-encoded value from Redis; on miss, parse error, or any
 * Redis failure, call `fetcher()` and write the result back with the
 * given TTL. Cache-write failures are swallowed.
 */
export async function cacheGetOrSet<T>(
  redis: Redis,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const raw = await redis.get(key);
    if (raw !== null) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        // Stored value is corrupt — fall through to refetch and overwrite.
      }
    }
  } catch {
    // Redis unavailable — degrade to direct DB fetch.
    return fetcher();
  }

  const fresh = await fetcher();
  try {
    await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
  } catch {
    // Swallow cache-write failures; the request already has its data.
  }
  return fresh;
}

/**
 * Drop a single key (exact match). Callers that need wildcards should
 * use a SCAN-based invalidator — this helper is intentionally limited
 * to O(1) DEL to keep it safe under load. Never throws.
 */
export async function cacheInvalidate(redis: Redis, key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // Nothing we can do — next reader will either pull fresh or hit stale.
  }
}
