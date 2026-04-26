// Redis-backed state for the Board WebSocket layer. Lifts the previous
// in-process `dirtyBoards` Map and presence/event broadcasting up to Redis
// so multi-instance deployments behave the same as the local single-
// instance stack: scene sync, cursor sync, last-collaborator-leaves
// flushes, and reconnect-window event replay all work regardless of
// which `board-api` replica any client landed on.
//
// Data model:
//   board:dirty:<boardId>          — JSON of latest unpersisted scene
//                                    + orgId + monotonic seq.
//   board:flush_lock:<boardId>     — SETNX'd by the instance that owns the
//                                    "this room is empty, flush now"
//                                    persist for ~10s. Stops two replicas
//                                    racing each other's flush.
//   board:events                   — Pub/sub channel for scene_update,
//                                    user_joined, user_left (existing).
//   board:cursors                  — Pub/sub channel for cursor_update
//                                    (NEW; previously local-only).
//   board:events:<boardId>         — XADD stream of scene_update events
//                                    capped at MAXLEN ~ 500 entries.
//                                    Used by the reconnect replay
//                                    protocol so a client coming back
//                                    from a transient WS drop can ask for
//                                    "everything after seq X" rather than
//                                    full-resyncing from /scene REST and
//                                    losing any peer edits that landed
//                                    during the gap.
//
// All ops swallow Redis errors and return a sentinel so the WS layer can
// continue (we'd rather degrade collaboration than crash the connection).

import type { Redis } from 'ioredis';
import type { SceneData } from './persistence.js';

// We accept a minimal logger-shaped interface so callers can pass either
// a pino Logger or Fastify's FastifyBaseLogger (which is structurally
// compatible but missing `msgPrefix`). All we use is .info / .warn /
// .error, so this is the smallest shape that lets us stay compatible
// with both without dragging pino in as a peer dep.
type LoggerLike = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export interface DirtyScene extends SceneData {
  orgId: string;
}

const DIRTY_KEY_PREFIX = 'board:dirty:';
const FLUSH_LOCK_KEY_PREFIX = 'board:flush_lock:';
const EVENTS_STREAM_KEY_PREFIX = 'board:events:';
const EVENTS_CHANNEL = 'board:events';
const CURSORS_CHANNEL = 'board:cursors';

/** Cap each board's event stream at ~500 entries (MAXLEN ~). The "~" is
 *  the approximate-cap form which lets Redis trim opportunistically and
 *  is much cheaper than the exact form. 500 covers minute-scale reconnect
 *  gaps for any realistic board edit rate; anything longer should
 *  full-resync via REST `/scene`. */
const EVENTS_STREAM_MAXLEN = 500;

/** TTL for the room-empty flush lock. Long enough that a slow disk write
 *  doesn't expire the lock mid-flush; short enough that a crashed
 *  replica releases its lock quickly. */
const FLUSH_LOCK_TTL_SECONDS = 10;

export class BoardRedisState {
  constructor(private readonly redis: Redis, private readonly logger: LoggerLike) {}

  // ─── Dirty scene hash ───────────────────────────────────────────────────

  async setDirty(boardId: string, scene: DirtyScene): Promise<void> {
    try {
      await this.redis.set(DIRTY_KEY_PREFIX + boardId, JSON.stringify(scene));
    } catch (err) {
      this.logger.error({ boardId, err }, 'BoardRedisState.setDirty failed');
    }
  }

  /** Atomic GET + DEL — used by the flush path so two replicas can't
   *  flush the same scene twice. We do this with a Lua script because
   *  ioredis's GETDEL only works on Redis 6.2+ and we want to stay
   *  compatible with older Redis versions some operators may run. */
  async takeDirty(boardId: string): Promise<DirtyScene | null> {
    try {
      const key = DIRTY_KEY_PREFIX + boardId;
      const raw = await this.redis.eval(
        `local v = redis.call('GET', KEYS[1])
         if v then redis.call('DEL', KEYS[1]) end
         return v`,
        1,
        key,
      ) as string | null;
      if (!raw) return null;
      return JSON.parse(raw) as DirtyScene;
    } catch (err) {
      this.logger.error({ boardId, err }, 'BoardRedisState.takeDirty failed');
      return null;
    }
  }

  /** Iterate every dirty key currently in Redis. Used by the periodic 5s
   *  flush so each replica does its share. SCAN keeps memory bounded. */
  async listDirtyBoardIds(): Promise<string[]> {
    const ids: string[] = [];
    try {
      let cursor = '0';
      do {
        const [next, batch] = await this.redis.scan(
          cursor,
          'MATCH',
          DIRTY_KEY_PREFIX + '*',
          'COUNT',
          200,
        );
        cursor = next;
        for (const k of batch) ids.push(k.slice(DIRTY_KEY_PREFIX.length));
      } while (cursor !== '0');
    } catch (err) {
      this.logger.error({ err }, 'BoardRedisState.listDirtyBoardIds failed');
    }
    return ids;
  }

  // ─── Room-empty flush lock ──────────────────────────────────────────────

  /** Atomic SETNX + EXPIRE. Returns true iff this caller now owns the
   *  flush for `boardId`. Other replicas SETNX the same key and get
   *  false back, so only one ends up persisting. */
  async tryAcquireFlushLock(boardId: string): Promise<boolean> {
    try {
      const result = await this.redis.set(
        FLUSH_LOCK_KEY_PREFIX + boardId,
        '1',
        'EX',
        FLUSH_LOCK_TTL_SECONDS,
        'NX',
      );
      return result === 'OK';
    } catch (err) {
      this.logger.error({ boardId, err }, 'BoardRedisState.tryAcquireFlushLock failed');
      return false;
    }
  }

  async releaseFlushLock(boardId: string): Promise<void> {
    try {
      await this.redis.del(FLUSH_LOCK_KEY_PREFIX + boardId);
    } catch {
      // Lock will expire on its own; not worth surfacing the error.
    }
  }

  // ─── Pub/sub publish ────────────────────────────────────────────────────

  async publishEvent(payload: Record<string, unknown>): Promise<void> {
    try {
      await this.redis.publish(EVENTS_CHANNEL, JSON.stringify(payload));
    } catch (err) {
      this.logger.error({ err }, 'BoardRedisState.publishEvent failed');
    }
  }

  async publishCursor(payload: Record<string, unknown>): Promise<void> {
    try {
      await this.redis.publish(CURSORS_CHANNEL, JSON.stringify(payload));
    } catch (err) {
      this.logger.error({ err }, 'BoardRedisState.publishCursor failed');
    }
  }

  // ─── Event stream (XADD / XREAD) for reconnect replay ───────────────────

  /** Append a scene-update event to the per-board stream. Returns the
   *  Redis-assigned stream id (e.g. "1714000000000-0") so callers can
   *  echo it back to clients as a cursor for replay. */
  async appendEvent(boardId: string, event: Record<string, unknown>): Promise<string | null> {
    try {
      const id = await this.redis.xadd(
        EVENTS_STREAM_KEY_PREFIX + boardId,
        'MAXLEN',
        '~',
        String(EVENTS_STREAM_MAXLEN),
        '*',
        'event',
        JSON.stringify(event),
      );
      return id ?? null;
    } catch (err) {
      this.logger.error({ boardId, err }, 'BoardRedisState.appendEvent failed');
      return null;
    }
  }

  /** Fetch every event after `lastSeenSeq` (exclusive). Returns an empty
   *  array when the cursor is 0 or null (first connection — no replay
   *  expected) and when nothing has happened since. The caller decodes
   *  the inner JSON. */
  async readEventsSince(boardId: string, lastSeenSeq: string | null): Promise<{ id: string; event: Record<string, unknown> }[]> {
    if (!lastSeenSeq) return [];
    try {
      const result = (await this.redis.xrange(
        EVENTS_STREAM_KEY_PREFIX + boardId,
        '(' + lastSeenSeq, // exclusive lower bound
        '+',
      )) as Array<[string, string[]]>;
      return result.map(([id, fields]) => {
        // fields is a flat [k, v, k, v, ...] array. We always set "event".
        const eventIdx = fields.findIndex((f) => f === 'event');
        const raw = eventIdx >= 0 ? fields[eventIdx + 1] : undefined;
        return {
          id,
          event: raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
        };
      });
    } catch (err) {
      this.logger.error({ boardId, err }, 'BoardRedisState.readEventsSince failed');
      return [];
    }
  }

  // ─── Channel name accessors (for subscribers) ──────────────────────────

  static get EVENTS_CHANNEL() { return EVENTS_CHANNEL; }
  static get CURSORS_CHANNEL() { return CURSORS_CHANNEL; }
}
