// §1 Wave 5 banter subs - pattern-match consumer.
//
// Subscribes to the Redis `banter:events` channel (the same fan-out used
// by the browser realtime WebSocket), filters for `message.created`
// payloads, and for each incoming message:
//
//   1. Loads active subscriptions for the channel from banter_agent_subscriptions.
//   2. Evaluates each subscription's pattern_spec against the message content.
//   3. Checks the §15 agent_policies row: enabled AND channel in
//      channel_subscriptions. If either fails, drop silently.
//   4. Runs can_access(subscriber_user_id, 'banter.channel', channel_id)
//      via the api preflight route. If denied, drop silently and increment
//      an internal counter.
//   5. Rate-limits: per-subscription hourly cap and per-subscriber hourly
//      ceiling across all subs. If either is exceeded, drop.
//   6. Otherwise, publishes banter.message.matched to Bolt ingest with
//      the payload schema defined in event-catalog.ts.
//   7. Bumps match_count and last_matched_at on the subscription row.
//
// This runs as a long-lived Redis subscriber rather than a BullMQ queue
// worker because the existing realtime bus is a pub/sub channel, not a
// queue. Each worker instance subscribes; if the stack runs multiple
// worker replicas, each evaluates the same message and the rate-limit
// INCR key is the cross-instance dedup mechanism (best-effort - a single
// subscription that matches in two workers within the same millisecond
// can double-fire). Perfect dedup would require a Redis SETNX guard per
// (subscription_id, message_id); Wave 5 §1 accepts the duplicate risk in
// favor of simplicity.

import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import {
  evaluateBanterPattern,
  publishBoltEvent,
  type BanterPatternSpec,
} from '@bigbluebam/shared';
import { getDb } from '../utils/db.js';

// ---------------------------------------------------------------------------
// Tuning knobs
// ---------------------------------------------------------------------------

const DEFAULT_PER_SUBSCRIBER_HOURLY_CAP = 300;
// How long to consider a per-subscription rate-limit key alive in Redis.
const RATE_LIMIT_EXPIRE_SECONDS = 3600;

// Internal counters. Exported for tests only.
export const internalCounters = {
  events_seen: 0,
  events_non_message: 0,
  subs_matched: 0,
  dropped_policy_disabled: 0,
  dropped_policy_channel_not_subscribed: 0,
  dropped_can_access_denied: 0,
  dropped_can_access_error: 0,
  dropped_rate_limit_sub: 0,
  dropped_rate_limit_subscriber: 0,
  emitted: 0,
};

// ---------------------------------------------------------------------------
// Types (keep in sync with banter-api's broadcastToChannel payload)
// ---------------------------------------------------------------------------

interface BanterEnvelope {
  room: string;
  event: {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
  };
}

interface MessageCreatedPayload {
  message: {
    id: string;
    channel_id: string;
    author_id: string;
    content_plain?: string;
    content?: string;
  };
}

interface ActiveSubscriptionRow {
  id: string;
  org_id: string;
  subscriber_user_id: string;
  channel_id: string;
  pattern_spec: BanterPatternSpec;
  rate_limit_per_hour: number;
}

// ---------------------------------------------------------------------------
// Dependencies injected at construction so tests can swap them out.
// ---------------------------------------------------------------------------

export interface PatternMatchDeps {
  /** Query active subs for a channel. */
  listActiveSubscriptions: (channelId: string) => Promise<ActiveSubscriptionRow[]>;
  /** Look up §15 agent_policy row. Null when the row is missing. */
  loadAgentPolicy: (
    agentUserId: string,
  ) => Promise<{ enabled: boolean; channel_subscriptions: string[] } | null>;
  /** Run the visibility preflight. Returns true when the subscriber can see the channel. */
  canAccessChannel: (subscriberUserId: string, channelId: string) => Promise<boolean>;
  /** Check + increment per-subscription hourly rate-limit; returns true when OK. */
  checkRateLimitSub: (subscriptionId: string, capPerHour: number) => Promise<boolean>;
  /** Check + increment per-subscriber hourly ceiling; returns true when OK. */
  checkRateLimitSubscriber: (
    subscriberUserId: string,
    ceilingPerHour: number,
  ) => Promise<boolean>;
  /** Publish the matched event. */
  publishMatched: (payload: MatchedEventPayload, orgId: string) => Promise<void>;
  /** Bump match_count + last_matched_at. */
  markMatched: (subscriptionId: string) => Promise<void>;
  logger: Logger;
  perSubscriberHourlyCap?: number;
}

export interface MatchedEventPayload {
  message: {
    id: string;
    channel_id: string;
    author_id: string;
    content: string;
  };
  match: {
    subscription_id: string;
    subscriber_user_id: string;
    pattern_kind: BanterPatternSpec['kind'];
    matched_text: string;
    matched_at: string;
  };
  org: { id: string };
}

// ---------------------------------------------------------------------------
// Core handler: one incoming realtime message -> zero-or-more Bolt events.
// Exported for unit tests.
// ---------------------------------------------------------------------------

export async function handleIncomingMessage(
  raw: BanterEnvelope,
  deps: PatternMatchDeps,
): Promise<void> {
  internalCounters.events_seen += 1;

  if (raw?.event?.type !== 'message.created') {
    internalCounters.events_non_message += 1;
    return;
  }
  const payload = raw.event.data as unknown as MessageCreatedPayload;
  const message = payload?.message;
  if (!message || !message.id || !message.channel_id) return;

  const content = message.content_plain ?? message.content ?? '';
  if (content.length === 0) return;

  const subs = await deps.listActiveSubscriptions(message.channel_id);
  if (subs.length === 0) return;

  const perSubscriberCap = deps.perSubscriberHourlyCap ?? DEFAULT_PER_SUBSCRIBER_HOURLY_CAP;
  const matchedAt = new Date().toISOString();

  for (const sub of subs) {
    try {
      // 1. Pattern evaluation.
      const outcome = evaluateBanterPattern(sub.pattern_spec, content);
      if (!outcome.matched || !outcome.matched_text) continue;
      internalCounters.subs_matched += 1;

      // Self-matches: don't fire when the author IS the subscriber.
      if (message.author_id === sub.subscriber_user_id) continue;

      // 2. §15 agent_policy gate.
      const policy = await deps.loadAgentPolicy(sub.subscriber_user_id);
      if (policy) {
        if (!policy.enabled) {
          internalCounters.dropped_policy_disabled += 1;
          continue;
        }
        if (
          Array.isArray(policy.channel_subscriptions) &&
          policy.channel_subscriptions.length > 0 &&
          !policy.channel_subscriptions.includes(sub.channel_id)
        ) {
          internalCounters.dropped_policy_channel_not_subscribed += 1;
          continue;
        }
      }

      // 3. Privacy preflight: can the subscriber see the channel?
      let accessOk = false;
      try {
        accessOk = await deps.canAccessChannel(sub.subscriber_user_id, sub.channel_id);
      } catch (err) {
        internalCounters.dropped_can_access_error += 1;
        deps.logger.warn(
          { err, subscription_id: sub.id },
          'banter-pattern-match: can_access threw; dropping match',
        );
        continue;
      }
      if (!accessOk) {
        internalCounters.dropped_can_access_denied += 1;
        continue;
      }

      // 4. Rate limits.
      const subOk = await deps.checkRateLimitSub(sub.id, sub.rate_limit_per_hour);
      if (!subOk) {
        internalCounters.dropped_rate_limit_sub += 1;
        continue;
      }
      const subscriberOk = await deps.checkRateLimitSubscriber(
        sub.subscriber_user_id,
        perSubscriberCap,
      );
      if (!subscriberOk) {
        internalCounters.dropped_rate_limit_subscriber += 1;
        continue;
      }

      // 5. Emit.
      const eventPayload: MatchedEventPayload = {
        message: {
          id: message.id,
          channel_id: message.channel_id,
          author_id: message.author_id,
          content,
        },
        match: {
          subscription_id: sub.id,
          subscriber_user_id: sub.subscriber_user_id,
          pattern_kind: sub.pattern_spec.kind,
          matched_text: outcome.matched_text,
          matched_at: matchedAt,
        },
        org: { id: sub.org_id },
      };
      await deps.publishMatched(eventPayload, sub.org_id);
      await deps.markMatched(sub.id);
      internalCounters.emitted += 1;
    } catch (err) {
      deps.logger.error(
        { err, subscription_id: sub.id },
        'banter-pattern-match: per-subscription processing failed',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Production wiring: Redis subscriber, db queries, api preflight, Bolt emit.
// ---------------------------------------------------------------------------

export async function startBanterPatternMatchConsumer(
  subscriberRedis: Redis,
  rateLimiterRedis: Redis,
  logger: Logger,
  opts: {
    apiInternalUrl: string;
    internalServiceSecret: string;
  },
): Promise<{ stop: () => Promise<void> }> {
  const deps = buildProductionDeps(rateLimiterRedis, logger, opts);

  subscriberRedis.on('message', (channel: string, raw: string) => {
    if (channel !== 'banter:events') return;
    let envelope: BanterEnvelope;
    try {
      envelope = JSON.parse(raw) as BanterEnvelope;
    } catch (err) {
      logger.warn({ err, raw }, 'banter-pattern-match: failed to parse envelope');
      return;
    }
    // Fire-and-forget; failures are logged inside the handler.
    handleIncomingMessage(envelope, deps).catch((err: unknown) => {
      logger.error({ err }, 'banter-pattern-match: unhandled handler error');
    });
  });

  await subscriberRedis.subscribe('banter:events');
  logger.info('banter-pattern-match: subscribed to banter:events');

  async function stop() {
    try {
      await subscriberRedis.unsubscribe('banter:events');
    } catch (err) {
      logger.warn({ err }, 'banter-pattern-match: unsubscribe failed');
    }
  }

  return { stop };
}

function buildProductionDeps(
  rateLimiterRedis: Redis,
  logger: Logger,
  opts: {
    apiInternalUrl: string;
    internalServiceSecret: string;
  },
): PatternMatchDeps {
  return {
    async listActiveSubscriptions(channelId: string) {
      const db = getDb();
      // Raw SQL - the worker doesn't import the banter-api Drizzle schema.
      const res = await db.execute(sql`
        SELECT id, org_id, subscriber_user_id, channel_id,
               pattern_spec, rate_limit_per_hour
          FROM banter_agent_subscriptions
         WHERE channel_id = ${channelId}
           AND disabled_at IS NULL
      `);
      const rows = (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as Array<{
        id: string;
        org_id: string;
        subscriber_user_id: string;
        channel_id: string;
        pattern_spec: BanterPatternSpec;
        rate_limit_per_hour: number;
      }>;
      return rows;
    },

    async loadAgentPolicy(agentUserId: string) {
      const db = getDb();
      const res = await db.execute(sql`
        SELECT enabled, channel_subscriptions
          FROM agent_policies
         WHERE agent_user_id = ${agentUserId}
      `);
      const rows = (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as Array<{
        enabled: boolean;
        channel_subscriptions: string[];
      }>;
      if (rows.length === 0) return null;
      return {
        enabled: rows[0]!.enabled === true,
        channel_subscriptions: Array.isArray(rows[0]!.channel_subscriptions)
          ? rows[0]!.channel_subscriptions
          : [],
      };
    },

    async canAccessChannel(subscriberUserId: string, channelId: string) {
      // Post against the api's /v1/visibility/can_access endpoint. The
      // api is authoritative for banter.channel visibility. If the api
      // returns 400 'unsupported_entity_type' (banter.channel not in its
      // allowlist yet) we fall back to a same-org / channel-membership
      // check via direct SQL so the subscription system works before
      // the api's preflight catches up.
      try {
        const res = await fetch(`${opts.apiInternalUrl}/v1/visibility/can_access`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': opts.internalServiceSecret,
          },
          body: JSON.stringify({
            asker_user_id: subscriberUserId,
            entity_type: 'banter.channel',
            entity_id: channelId,
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as {
            data?: { allowed?: boolean; reason?: string };
          };
          if (body?.data?.reason === 'unsupported_entity_type') {
            return await directChannelAccessCheck(subscriberUserId, channelId);
          }
          return body?.data?.allowed === true;
        }
        // 401/403 path (internal secret misconfigured etc) - try direct check.
        return await directChannelAccessCheck(subscriberUserId, channelId);
      } catch (err) {
        logger.warn(
          { err, subscriberUserId, channelId },
          'banter-pattern-match: visibility preflight network error; using direct check',
        );
        return await directChannelAccessCheck(subscriberUserId, channelId);
      }
    },

    async checkRateLimitSub(subscriptionId: string, capPerHour: number) {
      const key = `banter:match:rate:${subscriptionId}:${hourBucket()}`;
      const n = await rateLimiterRedis.incr(key);
      if (n === 1) {
        await rateLimiterRedis.expire(key, RATE_LIMIT_EXPIRE_SECONDS);
      }
      return n <= capPerHour;
    },

    async checkRateLimitSubscriber(subscriberUserId: string, ceilingPerHour: number) {
      const key = `banter:match:ceiling:${subscriberUserId}:${hourBucket()}`;
      const n = await rateLimiterRedis.incr(key);
      if (n === 1) {
        await rateLimiterRedis.expire(key, RATE_LIMIT_EXPIRE_SECONDS);
      }
      return n <= ceilingPerHour;
    },

    async publishMatched(payload: MatchedEventPayload, orgId: string) {
      await publishBoltEvent(
        'message.matched',
        'banter',
        payload as unknown as Record<string, unknown>,
        orgId,
        payload.match.subscriber_user_id,
        'agent',
      );
    },

    async markMatched(subscriptionId: string) {
      const db = getDb();
      await db.execute(sql`
        UPDATE banter_agent_subscriptions
           SET match_count = match_count + 1,
               last_matched_at = NOW()
         WHERE id = ${subscriptionId}
      `);
    },

    logger,
  };
}

function hourBucket(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}`;
}

/**
 * Fallback direct-SQL access check. Returns true when the subscriber is
 * a member of the channel OR the channel is public in the same org.
 */
async function directChannelAccessCheck(
  subscriberUserId: string,
  channelId: string,
): Promise<boolean> {
  const db = getDb();
  const res = await db.execute(sql`
    SELECT
      bc.id,
      bc.type,
      bc.org_id AS channel_org_id,
      u.org_id  AS user_org_id,
      EXISTS (
        SELECT 1 FROM banter_channel_memberships bm
         WHERE bm.channel_id = bc.id
           AND bm.user_id = ${subscriberUserId}
      ) AS is_member
      FROM banter_channels bc
      JOIN users u ON u.id = ${subscriberUserId}
     WHERE bc.id = ${channelId}
  `);
  const rows = (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as Array<{
    type: string;
    channel_org_id: string;
    user_org_id: string;
    is_member: boolean;
  }>;
  if (rows.length === 0) return false;
  const row = rows[0]!;
  if (row.channel_org_id !== row.user_org_id) return false;
  if (row.is_member) return true;
  // Public channels: same-org member can see even without explicit membership.
  return row.type === 'public';
}
