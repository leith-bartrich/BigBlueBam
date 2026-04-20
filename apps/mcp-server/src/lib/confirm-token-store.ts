import Redis from 'ioredis';
import type { Logger } from 'pino';

/**
 * Store for confirm_action pending-confirmation tokens (AGENTIC_TODO §9 Wave 2
 * follow-up). Redis-backed so tokens survive mcp-server restarts and so the
 * staging and confirm legs can land on different MCP instances behind a load
 * balancer.
 *
 * Key shape: `mcp:confirm_token:{token}`. Value is JSON of ConfirmTokenEntry.
 * Expiry is managed by Redis via PX so we do not need our own sweeper.
 *
 * Graceful degradation: if Redis is unavailable, the store falls back to an
 * in-process Map with its own interval sweeper. That matches the pre-Wave-2
 * behavior exactly, so the tool keeps working in dev setups without Redis
 * and during Redis outages, at the cost of tokens not surviving restarts.
 */

export interface ConfirmTokenEntry {
  action: string;
  resource_id: string;
  /** TTL in ms that was applied at set() time. Echoed in the staging response. */
  ttlMs: number;
}

export interface ConfirmTokenStore {
  /** Store a new token with a relative TTL. Overwrites any existing token. */
  set(token: string, entry: ConfirmTokenEntry): Promise<void>;
  /**
   * Peek a token without consuming it. Returns null if not found or expired.
   * Used to validate (action, resource_id) match before consuming.
   */
  get(token: string): Promise<ConfirmTokenEntry | null>;
  /** Remove a token. Safe to call on nonexistent tokens. */
  delete(token: string): Promise<void>;
  /** Graceful shutdown hook for the Redis connection. */
  close(): Promise<void>;
}

export interface ConfirmTokenStoreOptions {
  redisUrl: string;
  logger: Logger;
  /** Fallback-sweeper interval. Exposed for tests. Default 30s. */
  fallbackSweepMs?: number;
}

interface FallbackEntry extends ConfirmTokenEntry {
  expiresAt: number;
}

const REDIS_KEY_PREFIX = 'mcp:confirm_token:';

export function createConfirmTokenStore(
  opts: ConfirmTokenStoreOptions,
): ConfirmTokenStore {
  let client: Redis | null = null;
  let connectAttempted = false;
  let unavailableLogged = false;

  const fallback = new Map<string, FallbackEntry>();
  const sweepMs = opts.fallbackSweepMs ?? 30_000;
  const sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of fallback) {
      if (entry.expiresAt <= now) fallback.delete(token);
    }
  }, sweepMs);
  if (typeof sweepTimer.unref === 'function') sweepTimer.unref();

  async function getClient(): Promise<Redis | null> {
    if (client) return client;
    if (connectAttempted && !client) return null;
    connectAttempted = true;
    try {
      const c = new Redis(opts.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      await c.connect();
      client = c;
      unavailableLogged = false;
      c.on('error', (err: Error) => {
        if (!unavailableLogged) {
          opts.logger.warn({ err }, 'confirm-token store: Redis error, falling back to in-process map');
          unavailableLogged = true;
        }
      });
      return c;
    } catch (err) {
      if (!unavailableLogged) {
        opts.logger.warn(
          { err },
          'confirm-token store: Redis unavailable; tokens will not survive restarts',
        );
        unavailableLogged = true;
      }
      return null;
    }
  }

  async function set(token: string, entry: ConfirmTokenEntry): Promise<void> {
    const key = REDIS_KEY_PREFIX + token;
    const value = JSON.stringify(entry);
    const c = await getClient();
    if (c) {
      try {
        await c.set(key, value, 'PX', entry.ttlMs);
        return;
      } catch (err) {
        if (!unavailableLogged) {
          opts.logger.warn({ err }, 'confirm-token store: SET failed; using in-process fallback');
          unavailableLogged = true;
        }
      }
    }
    fallback.set(token, { ...entry, expiresAt: Date.now() + entry.ttlMs });
  }

  async function get(token: string): Promise<ConfirmTokenEntry | null> {
    const c = await getClient();
    if (c) {
      try {
        const raw = await c.get(REDIS_KEY_PREFIX + token);
        if (raw) {
          const parsed = JSON.parse(raw) as ConfirmTokenEntry;
          return parsed;
        }
      } catch (err) {
        if (!unavailableLogged) {
          opts.logger.warn({ err }, 'confirm-token store: GET failed; falling back to in-process map');
          unavailableLogged = true;
        }
      }
    }
    const entry = fallback.get(token);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      fallback.delete(token);
      return null;
    }
    const { expiresAt: _ignored, ...result } = entry;
    return result;
  }

  async function del(token: string): Promise<void> {
    const c = await getClient();
    if (c) {
      try {
        await c.del(REDIS_KEY_PREFIX + token);
      } catch {
        // Best-effort: if Redis delete fails the entry will auto-expire anyway.
      }
    }
    fallback.delete(token);
  }

  async function close(): Promise<void> {
    clearInterval(sweepTimer);
    fallback.clear();
    if (client) {
      try {
        await client.quit();
      } catch {
        // best-effort on shutdown
      }
      client = null;
    }
  }

  return { set, get, delete: del, close };
}

export const CONFIRM_TOKEN_KEY_PREFIX = REDIS_KEY_PREFIX;
