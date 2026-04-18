// §1 Wave 5 banter subs - agent subscription service.
//
// Encapsulates the create / disable / list operations plus the write-side
// gates:
//   1. Subscriber must be users.kind IN ('agent','service').
//   2. Channel's agent_subscription_policy.allow must be true.
//   3. If agent_subscription_policy.allowed_agent_ids is non-empty, the
//      subscriber must be in it.
//   4. For §15 agent_policies: the subscriber's policy must be enabled AND
//      its channel_subscriptions array must include channel_id. Both
//      conditions surface as `effective: false` with a reason string on
//      the subscribe call, rather than as a hard error, so an MCP caller
//      can see "the row exists but we're not going to route matches yet."
//   5. Regex patterns are ADMIN-ONLY writes; non-admin callers attempting
//      a regex spec are rejected before the row is written.
//
// Pattern-spec shape and runtime evaluator live in
// @bigbluebam/shared/banter-pattern-match.ts so the worker consumer can
// share the exact same types and evaluator with no drift.

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  evaluateBanterPattern,
  canonicalizeBanterPatternSpec,
  type BanterPatternSpec,
} from '@bigbluebam/shared';
import { db } from '../db/index.js';
import {
  banterAgentSubscriptions,
  banterChannels,
  banterChannelMemberships,
  agentPolicies,
  users,
} from '../db/schema/index.js';

export interface ChannelAgentSubscriptionPolicy {
  allow: boolean;
  allowed_agent_ids: string[];
}

export interface SubscribeResult {
  subscription_id: string;
  effective: boolean;
  reason?: string;
}

export interface SubscriptionRow {
  id: string;
  org_id: string;
  subscriber_user_id: string;
  channel_id: string;
  pattern_spec: BanterPatternSpec;
  rate_limit_per_hour: number;
  match_count: number;
  last_matched_at: Date | null;
  disabled_at: Date | null;
  opted_in_at: Date;
  created_at: Date;
}

export class AgentSubscriptionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AgentSubscriptionError';
  }
}

function defaultChannelPolicy(): ChannelAgentSubscriptionPolicy {
  return { allow: false, allowed_agent_ids: [] };
}

function parseChannelPolicy(raw: unknown): ChannelAgentSubscriptionPolicy {
  if (!raw || typeof raw !== 'object') return defaultChannelPolicy();
  const obj = raw as Record<string, unknown>;
  const allow = typeof obj.allow === 'boolean' ? obj.allow : false;
  const ids = Array.isArray(obj.allowed_agent_ids)
    ? obj.allowed_agent_ids.filter((x): x is string => typeof x === 'string')
    : [];
  return { allow, allowed_agent_ids: ids };
}

function isOrgAdminRole(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Validate a pattern spec at write time. Returns null when valid;
 * returns a string error code otherwise.
 */
export function validatePatternSpec(
  spec: unknown,
): { ok: true; spec: BanterPatternSpec } | { ok: false; reason: string } {
  if (!spec || typeof spec !== 'object') {
    return { ok: false, reason: 'pattern_spec must be an object' };
  }
  const s = spec as Record<string, unknown>;
  switch (s.kind) {
    case 'interrogative':
      return { ok: true, spec: { kind: 'interrogative' } };
    case 'keyword': {
      if (!Array.isArray(s.terms) || s.terms.length === 0) {
        return { ok: false, reason: 'keyword.terms must be a non-empty array' };
      }
      if (s.terms.some((t) => typeof t !== 'string' || t.length === 0)) {
        return { ok: false, reason: 'keyword.terms must contain non-empty strings' };
      }
      if (s.terms.length > 50) {
        return { ok: false, reason: 'keyword.terms cannot exceed 50 entries' };
      }
      const mode = s.mode ?? 'any';
      if (mode !== 'any' && mode !== 'all') {
        return { ok: false, reason: "keyword.mode must be 'any' or 'all'" };
      }
      return {
        ok: true,
        spec: {
          kind: 'keyword',
          terms: s.terms as string[],
          mode: mode as 'any' | 'all',
          case_sensitive: s.case_sensitive === true,
        },
      };
    }
    case 'regex': {
      if (typeof s.pattern !== 'string' || s.pattern.length === 0) {
        return { ok: false, reason: 'regex.pattern must be a non-empty string' };
      }
      if (s.pattern.length > 512) {
        return { ok: false, reason: 'regex.pattern cannot exceed 512 chars' };
      }
      // Smoke-test the regex. new RegExp throws on bad syntax.
      try {
        new RegExp(s.pattern, typeof s.flags === 'string' ? s.flags : '');
      } catch (err) {
        return {
          ok: false,
          reason: `regex.pattern is not a valid JS regex: ${err instanceof Error ? err.message : 'unknown'}`,
        };
      }
      return {
        ok: true,
        spec: {
          kind: 'regex',
          pattern: s.pattern,
          flags: typeof s.flags === 'string' ? s.flags : undefined,
        },
      };
    }
    case 'mention': {
      if (typeof s.user_id !== 'string' || typeof s.display_name !== 'string') {
        return { ok: false, reason: 'mention.user_id and mention.display_name required' };
      }
      return {
        ok: true,
        spec: {
          kind: 'mention',
          user_id: s.user_id,
          display_name: s.display_name,
        },
      };
    }
    default:
      return { ok: false, reason: `unknown pattern kind: ${String(s.kind)}` };
  }
}

interface SubscribeInput {
  subscriber_user_id: string;
  channel_id: string;
  org_id: string;
  opted_in_by: string;
  opted_in_by_role: string; // to gate regex writes
  pattern: BanterPatternSpec;
  rate_limit_per_hour?: number;
}

/**
 * Create (or re-enable and update) an agent subscription row. Throws
 * AgentSubscriptionError on write gates (bad user kind, channel not
 * found, etc). Returns `{ effective: false, reason }` when the row is
 * stored but the §15 agent policy or the channel policy blocks routing;
 * the caller is expected to surface this to operators.
 */
export async function createSubscription(input: SubscribeInput): Promise<SubscribeResult> {
  // 1. Subscriber must exist and be agent/service kind.
  const [subscriber] = await db
    .select({ id: users.id, org_id: users.org_id, kind: users.kind })
    .from(users)
    .where(eq(users.id, input.subscriber_user_id))
    .limit(1);
  if (!subscriber) {
    throw new AgentSubscriptionError('NOT_FOUND', 'subscriber user not found');
  }
  if (subscriber.kind !== 'agent' && subscriber.kind !== 'service') {
    throw new AgentSubscriptionError(
      'NOT_AN_AGENT',
      'subscriber_user_id must be an agent or service account',
    );
  }
  if (subscriber.org_id !== input.org_id) {
    throw new AgentSubscriptionError(
      'CROSS_ORG',
      'subscriber belongs to a different org',
    );
  }

  // 2. Channel must exist, be in the same org, and its policy must allow
  // the subscriber. Pulled in one query.
  const [channel] = await db
    .select({
      id: banterChannels.id,
      org_id: banterChannels.org_id,
      policy: banterChannels.agent_subscription_policy,
    })
    .from(banterChannels)
    .where(eq(banterChannels.id, input.channel_id))
    .limit(1);
  if (!channel) {
    throw new AgentSubscriptionError('NOT_FOUND', 'channel not found');
  }
  if (channel.org_id !== input.org_id) {
    throw new AgentSubscriptionError('CROSS_ORG', 'channel belongs to a different org');
  }
  const channelPolicy = parseChannelPolicy(channel.policy);

  // 3. Regex patterns are admin-only.
  if (input.pattern.kind === 'regex' && !isOrgAdminRole(input.opted_in_by_role)) {
    throw new AgentSubscriptionError(
      'REGEX_ADMIN_ONLY',
      "regex patterns are admin-only to mitigate ReDoS; use 'keyword' instead",
    );
  }

  // Decide "effective" gate. A subscription row is written regardless of
  // whether it is currently effective - operators may prepare
  // subscriptions before the channel policy opens. The worker consumer
  // separately re-checks both gates at match time.
  let effective = true;
  let reason: string | undefined;

  if (!channelPolicy.allow) {
    effective = false;
    reason = 'channel_policy_disallow';
  } else if (
    channelPolicy.allowed_agent_ids.length > 0 &&
    !channelPolicy.allowed_agent_ids.includes(input.subscriber_user_id)
  ) {
    effective = false;
    reason = 'channel_policy_not_in_allowlist';
  } else {
    // 4. §15 agent_policies gate: row must exist, enabled, and channel_id
    // must be in channel_subscriptions. A missing policy row is treated
    // as "not yet wired" rather than a hard error; it's still effective
    // once the policy is created.
    const [policy] = await db
      .select({
        enabled: agentPolicies.enabled,
        channel_subscriptions: agentPolicies.channel_subscriptions,
      })
      .from(agentPolicies)
      .where(eq(agentPolicies.agent_user_id, input.subscriber_user_id))
      .limit(1);
    if (policy) {
      if (!policy.enabled) {
        effective = false;
        reason = 'agent_policy_disabled';
      } else if (
        Array.isArray(policy.channel_subscriptions) &&
        policy.channel_subscriptions.length > 0 &&
        !policy.channel_subscriptions.includes(input.channel_id)
      ) {
        effective = false;
        reason = 'agent_policy_channel_not_subscribed';
      }
    }
    // Missing policy row - leave effective=true. The worker also has
    // its own policy-gate check; an agent with no policy row will be
    // permissive-default (see migration 0139 backfill) so this matches
    // the "effective until operator narrows" convention.
  }

  // Insert (or re-enable) the row. The unique index is partial on
  // disabled_at IS NULL; we upsert by matching the same actor/channel/
  // md5(pattern_spec) tuple for active rows.
  const specJson = canonicalizeBanterPatternSpec(input.pattern);
  const rateLimit =
    typeof input.rate_limit_per_hour === 'number'
      ? Math.min(Math.max(input.rate_limit_per_hour, 1), 3600)
      : 30;

  const [existing] = await db
    .select({ id: banterAgentSubscriptions.id })
    .from(banterAgentSubscriptions)
    .where(
      and(
        eq(banterAgentSubscriptions.subscriber_user_id, input.subscriber_user_id),
        eq(banterAgentSubscriptions.channel_id, input.channel_id),
        isNull(banterAgentSubscriptions.disabled_at),
        sql`md5(${banterAgentSubscriptions.pattern_spec}::text) = md5(${specJson}::text)`,
      ),
    )
    .limit(1);

  if (existing) {
    // Idempotent: already have an active row with the same spec.
    return { subscription_id: existing.id, effective, ...(reason ? { reason } : {}) };
  }

  const [inserted] = await db
    .insert(banterAgentSubscriptions)
    .values({
      org_id: input.org_id,
      subscriber_user_id: input.subscriber_user_id,
      channel_id: input.channel_id,
      pattern_spec: input.pattern as unknown as Record<string, unknown>,
      opted_in_by: input.opted_in_by,
      rate_limit_per_hour: rateLimit,
    })
    .returning({ id: banterAgentSubscriptions.id });

  return {
    subscription_id: inserted!.id,
    effective,
    ...(reason ? { reason } : {}),
  };
}

export async function disableSubscription(
  subscription_id: string,
  actor_user_id: string,
  actor_org_id: string,
  actor_is_superuser: boolean,
): Promise<{ subscription_id: string; disabled_at: Date }> {
  const [row] = await db
    .select({
      id: banterAgentSubscriptions.id,
      org_id: banterAgentSubscriptions.org_id,
      subscriber_user_id: banterAgentSubscriptions.subscriber_user_id,
      disabled_at: banterAgentSubscriptions.disabled_at,
    })
    .from(banterAgentSubscriptions)
    .where(eq(banterAgentSubscriptions.id, subscription_id))
    .limit(1);
  if (!row) {
    throw new AgentSubscriptionError('NOT_FOUND', 'subscription not found');
  }
  if (!actor_is_superuser && row.org_id !== actor_org_id) {
    throw new AgentSubscriptionError('CROSS_ORG', 'subscription belongs to a different org');
  }
  // Owner or SuperUser can unsubscribe; other callers rejected.
  if (!actor_is_superuser && row.subscriber_user_id !== actor_user_id) {
    // Channel/org admins may also unsubscribe agents from channels they
    // administer, but that policy belongs to the route layer; the
    // service only enforces self-unsubscribe or superuser.
    throw new AgentSubscriptionError(
      'FORBIDDEN',
      'only the subscriber or a SuperUser can disable this subscription via this path',
    );
  }
  if (row.disabled_at) {
    return { subscription_id: row.id, disabled_at: row.disabled_at };
  }
  const disabledAt = new Date();
  await db
    .update(banterAgentSubscriptions)
    .set({ disabled_at: disabledAt })
    .where(eq(banterAgentSubscriptions.id, subscription_id));
  return { subscription_id: row.id, disabled_at: disabledAt };
}

export async function listSubscriptionsForSubscriber(
  subscriber_user_id: string,
  org_id: string,
  channel_id?: string,
): Promise<SubscriptionRow[]> {
  const whereBits = [
    eq(banterAgentSubscriptions.subscriber_user_id, subscriber_user_id),
    eq(banterAgentSubscriptions.org_id, org_id),
    isNull(banterAgentSubscriptions.disabled_at),
  ];
  if (channel_id) whereBits.push(eq(banterAgentSubscriptions.channel_id, channel_id));
  const rows = await db
    .select()
    .from(banterAgentSubscriptions)
    .where(and(...whereBits))
    .orderBy(desc(banterAgentSubscriptions.created_at))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    org_id: r.org_id,
    subscriber_user_id: r.subscriber_user_id,
    channel_id: r.channel_id,
    pattern_spec: r.pattern_spec as unknown as BanterPatternSpec,
    rate_limit_per_hour: r.rate_limit_per_hour,
    match_count: r.match_count,
    last_matched_at: r.last_matched_at ?? null,
    disabled_at: r.disabled_at ?? null,
    opted_in_at: r.opted_in_at,
    created_at: r.created_at,
  }));
}

/**
 * List active subscriptions for a channel. Used by the worker pattern-
 * match consumer on every incoming message. Returns only rows where
 * disabled_at IS NULL; the worker separately evaluates per-row pattern +
 * rate-limit + policy gates.
 */
export async function listActiveSubscriptionsForChannel(
  channel_id: string,
): Promise<SubscriptionRow[]> {
  const rows = await db
    .select()
    .from(banterAgentSubscriptions)
    .where(
      and(
        eq(banterAgentSubscriptions.channel_id, channel_id),
        isNull(banterAgentSubscriptions.disabled_at),
      ),
    )
    .limit(500);
  return rows.map((r) => ({
    id: r.id,
    org_id: r.org_id,
    subscriber_user_id: r.subscriber_user_id,
    channel_id: r.channel_id,
    pattern_spec: r.pattern_spec as unknown as BanterPatternSpec,
    rate_limit_per_hour: r.rate_limit_per_hour,
    match_count: r.match_count,
    last_matched_at: r.last_matched_at ?? null,
    disabled_at: r.disabled_at ?? null,
    opted_in_at: r.opted_in_at,
    created_at: r.created_at,
  }));
}

/**
 * Re-export evaluator so the worker can import from one place at runtime
 * if needed. (Not strictly necessary - the worker can import from
 * @bigbluebam/shared directly.)
 */
export { evaluateBanterPattern };

// Keep channel-memberships reference used by future route gating.
export { banterChannelMemberships };
