import Redis from 'ioredis';
import type { Logger } from 'pino';

/**
 * Redis-backed deduplication store for intake flows (AGENTIC_TODO §19, Wave 5).
 *
 * Key shape: `ingest:fp:{org_id}:{source}:{fingerprint}`
 *
 * Semantics: `checkAndSet` uses `SET key "1" NX EX windowSeconds`. On success
 * (NX wins), the caller is the first to submit this fingerprint within the
 * window and `first_seen: true` is returned. On failure (key already exists),
 * the caller is reporting a duplicate and we return `first_seen: false` along
 * with the key's remaining TTL so the caller can report when the original
 * sighting happened.
 *
 * This module is a thin wrapper: it owns a single lazy `ioredis` connection
 * per process and degrades gracefully if Redis is unavailable (the mcp-server
 * must not hard-fail just because intake dedup can't reach Redis).
 *
 * Graceful degradation contract:
 *   - If Redis throws on the first call, the error is logged once and every
 *     subsequent call returns `{ first_seen: true, redis_unavailable: true }`.
 *     This is the fail-OPEN posture: we'd rather process a duplicate than
 *     drop a legitimate intake because Redis is down. Intake flows that need
 *     strict dedup should layer a persistent store on top.
 *   - If Redis comes back, the next call that connects successfully resets
 *     the `redis_unavailable` flag and resumes normal operation.
 */

const WINDOW_MAX_SECONDS = 3600; // §19: hard cap on dedup windows

export interface FingerprintCheckResult {
  first_seen: boolean;
  /** ISO timestamp of the original sighting when first_seen is false. */
  seen_at?: string;
  /** Configured window in seconds. Echoed back for caller-side reconciliation. */
  window_seconds: number;
  /** Remaining TTL on the key in seconds, when first_seen is false. */
  ttl_remaining?: number;
  /** Present when Redis is unavailable; value is 'redis_unavailable'. */
  note?: 'redis_unavailable';
}

export class WindowTooLargeError extends Error {
  constructor(public window_seconds: number, public max: number) {
    super(
      `window_seconds=${window_seconds} exceeds the maximum allowed (${max}s / 1 hour)`,
    );
    this.name = 'WindowTooLargeError';
  }
}

export interface FingerprintStoreOptions {
  redisUrl: string;
  logger: Logger;
}

export interface FingerprintStore {
  checkAndSet(
    orgId: string,
    source: string,
    fingerprint: string,
    windowSeconds: number,
  ): Promise<FingerprintCheckResult>;
  /** For graceful shutdown. */
  close(): Promise<void>;
}

/**
 * Build a FingerprintStore. The Redis client is created lazy-connect; we
 * only dial on first use so the mcp-server can start even if Redis is down.
 */
export function createFingerprintStore(
  opts: FingerprintStoreOptions,
): FingerprintStore {
  let client: Redis | null = null;
  let connectAttempted = false;
  let unavailableLogged = false;

  async function getClient(): Promise<Redis | null> {
    if (client) return client;
    if (connectAttempted && !client) return null;
    connectAttempted = true;
    try {
      const c = new Redis(opts.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        // Keep the command queue short so one Redis outage doesn't back
        // pressure every call that queues behind it; we'd rather fail-open.
        enableOfflineQueue: false,
      });
      await c.connect();
      client = c;
      unavailableLogged = false;
      // Attach a single error listener so we don't spam logs on every reconnect.
      c.on('error', (err: Error) => {
        if (!unavailableLogged) {
          opts.logger.warn({ err }, 'ingest fingerprint store: Redis error');
          unavailableLogged = true;
        }
      });
      return c;
    } catch (err) {
      if (!unavailableLogged) {
        opts.logger.warn(
          { err },
          'ingest fingerprint store: Redis unavailable; falling back to fail-open mode',
        );
        unavailableLogged = true;
      }
      return null;
    }
  }

  async function checkAndSet(
    orgId: string,
    source: string,
    fingerprint: string,
    windowSeconds: number,
  ): Promise<FingerprintCheckResult> {
    if (windowSeconds > WINDOW_MAX_SECONDS) {
      throw new WindowTooLargeError(windowSeconds, WINDOW_MAX_SECONDS);
    }
    if (windowSeconds < 1) {
      throw new WindowTooLargeError(windowSeconds, WINDOW_MAX_SECONDS);
    }

    const c = await getClient();
    if (!c) {
      return {
        first_seen: true,
        window_seconds: windowSeconds,
        note: 'redis_unavailable',
      };
    }

    const key = `ingest:fp:${orgId}:${source}:${fingerprint}`;
    const nowIso = new Date().toISOString();

    try {
      // SET key value NX EX windowSeconds — atomic first-seen check.
      const res = await c.set(key, nowIso, 'EX', windowSeconds, 'NX');
      if (res === 'OK') {
        return { first_seen: true, window_seconds: windowSeconds };
      }

      // Key already exists. Pull the stored timestamp and the remaining TTL
      // in parallel for the caller's benefit. We tolerate either probe
      // failing: the duplicate signal is what matters.
      const [storedAt, ttl] = await Promise.all([
        c.get(key).catch(() => null),
        c.ttl(key).catch(() => -1),
      ]);
      return {
        first_seen: false,
        seen_at: storedAt ?? undefined,
        window_seconds: windowSeconds,
        ttl_remaining: ttl >= 0 ? ttl : undefined,
      };
    } catch (err) {
      if (!unavailableLogged) {
        opts.logger.warn(
          { err, key },
          'ingest fingerprint store: SET NX EX failed; failing open',
        );
        unavailableLogged = true;
      }
      return {
        first_seen: true,
        window_seconds: windowSeconds,
        note: 'redis_unavailable',
      };
    }
  }

  async function close(): Promise<void> {
    if (client) {
      try {
        await client.quit();
      } catch {
        // best-effort on shutdown
      }
      client = null;
    }
  }

  return { checkAndSet, close };
}

export const FINGERPRINT_WINDOW_MAX_SECONDS = WINDOW_MAX_SECONDS;
