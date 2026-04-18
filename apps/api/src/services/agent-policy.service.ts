import { and, eq, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { db } from '../db/index.js';
import { agentPolicies } from '../db/schema/agent-policies.js';
import { agentRunners } from '../db/schema/agent-runners.js';
import { users } from '../db/schema/users.js';

/**
 * Agent-policy service (AGENTIC_TODO §15, Wave 5).
 *
 * Drives the fail-closed policy check the MCP register-tool wrapper runs on
 * every tool invocation by a service-account caller. Policies are owned by
 * humans; every agent/service user has a permissive default backfilled by
 * migration 0139.
 *
 * Allowlist semantics:
 *   - A single entry `'*'` means allow every tool.
 *   - Otherwise an entry like `banter.*` matches any tool whose name starts
 *     with `banter.` OR equals `banter`. Entries without a trailing `.*` are
 *     exact-match only.
 *
 * Core tools (`get_server_info`, `get_me`, `agent_heartbeat`) are permitted
 * independently of this list; the register-tool wrapper short-circuits them
 * before consulting the policy. They are NOT special-cased here so this
 * service stays the single truth for "did the operator allow this tool".
 */

const REDIS_INVALIDATE_CHANNEL = 'agent_policies:invalidate';

export type AgentPolicyRow = {
  agent_user_id: string;
  org_id: string;
  enabled: boolean;
  allowed_tools: string[];
  channel_subscriptions: string[];
  rate_limit_override: number | null;
  notes: string | null;
  updated_at: Date;
  updated_by: string;
};

export type AgentPolicyWithActor = AgentPolicyRow & {
  updated_by_user: { id: string; name: string } | null;
};

export type SetPolicyPatch = {
  enabled?: boolean;
  allowed_tools?: string[];
  channel_subscriptions?: string[];
  rate_limit_override?: number | null;
  notes?: string | null;
};

export type CheckResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'AGENT_DISABLED' | 'TOOL_NOT_ALLOWED';
      agent_user_id: string;
      disabled_at: string | null;
      contact: string | null;
    };

export type SetPolicyResult = AgentPolicyWithActor & {
  confirmation_required: boolean;
};

export type ListPolicyRow = {
  agent_user_id: string;
  agent_name: string;
  enabled: boolean;
  allowed_tool_count: number;
  last_heartbeat_at: string | null;
  updated_at: string;
};

function normalize(raw: typeof agentPolicies.$inferSelect): AgentPolicyRow {
  return {
    agent_user_id: raw.agent_user_id,
    org_id: raw.org_id,
    enabled: raw.enabled,
    allowed_tools: raw.allowed_tools as string[],
    channel_subscriptions: raw.channel_subscriptions as string[],
    rate_limit_override: raw.rate_limit_override ?? null,
    notes: raw.notes ?? null,
    updated_at: raw.updated_at,
    updated_by: raw.updated_by,
  };
}

/**
 * Allowlist matcher. Exported for tests.
 *
 *   matchesAllowlist('banter.*', 'banter_post_message') === false (prefix is a literal)
 *   matchesAllowlist('banter_.*', 'banter_post_message') === true
 *
 * The glob semantics are deliberately simple: a trailing `.*` (or `_*`, `-*`)
 * matches anything starting with the prefix, and a bare `*` matches everything.
 * Anything else is an exact string match. The `.` in `banter.*` is treated as
 * a literal, not a regex metacharacter; in practice our tool naming convention
 * is `<app>_<verb>` (banter_post_message, bond_get_deal), so callers should
 * write `banter_*` or `banter_`. We also accept `banter.*` as an alias for
 * `banter_*` since the doc examples use the dotted form.
 */
export function matchesAllowlist(pattern: string, toolName: string): boolean {
  if (pattern === '*') return true;
  // Dotted-form alias: banter.* -> banter_* (or banter.<rest>)
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return (
      toolName === prefix ||
      toolName.startsWith(`${prefix}_`) ||
      toolName.startsWith(`${prefix}.`)
    );
  }
  if (pattern.endsWith('_*')) {
    const prefix = pattern.slice(0, -2);
    return toolName === prefix || toolName.startsWith(`${prefix}_`);
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return toolName.startsWith(prefix);
  }
  return pattern === toolName;
}

export function isToolAllowed(allowedTools: string[], toolName: string): boolean {
  if (allowedTools.length === 0) return false;
  return allowedTools.some((p) => matchesAllowlist(p, toolName));
}

/**
 * Look up the policy row for an agent, joined with the updater's display name.
 * Returns null when the row does not exist (the backfill covers every
 * existing agent/service user, so a miss typically means a user was added
 * after migration 0139 — callers may want to lazily create a permissive row
 * when that happens, but that is a write and lives in setPolicy).
 */
export async function getPolicy(agent_user_id: string): Promise<AgentPolicyWithActor | null> {
  const rows = await db
    .select({
      policy: agentPolicies,
      updater_id: users.id,
      updater_name: users.display_name,
    })
    .from(agentPolicies)
    .leftJoin(users, eq(agentPolicies.updated_by, users.id))
    .where(eq(agentPolicies.agent_user_id, agent_user_id))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0]!;
  return {
    ...normalize(row.policy),
    updated_by_user: row.updater_id
      ? { id: row.updater_id, name: row.updater_name ?? '' }
      : null,
  };
}

/**
 * Upsert a policy. Returns `confirmation_required: true` when the call would
 * flip `enabled: false` on an already-enabled policy (kill-switch path). The
 * caller is expected to re-submit with a `confirmation_token` via the
 * confirm_action flow; Wave 5 §15 leaves the token binding to the MCP tool
 * wrapper (agent_policy_set) since this service is transport-agnostic.
 *
 * When the patch actually flips enabled: false, publishes an invalidate
 * message to Redis so live MCP sessions can drop the policy from their cache.
 */
export async function setPolicy(
  agent_user_id: string,
  patch: SetPolicyPatch,
  actor: { id: string; org_id: string },
  redis: Redis | null,
): Promise<SetPolicyResult | { error: 'NOT_AN_AGENT' | 'CROSS_ORG' }> {
  const [target] = await db
    .select({ id: users.id, org_id: users.org_id, kind: users.kind })
    .from(users)
    .where(eq(users.id, agent_user_id))
    .limit(1);

  if (!target || (target.kind !== 'agent' && target.kind !== 'service')) {
    return { error: 'NOT_AN_AGENT' };
  }
  if (target.org_id !== actor.org_id) {
    return { error: 'CROSS_ORG' };
  }

  const existing = await getPolicy(agent_user_id);

  // Detect the "disable a live agent" case so the tool layer can demand
  // confirm_action. The detection applies on the PRE-write state so the
  // caller can see whether they are about to flip the enabled bit.
  const willDisable =
    patch.enabled === false && (existing?.enabled ?? true) === true;

  const valueSet: Record<string, unknown> = {
    updated_by: actor.id,
    updated_at: new Date(),
  };
  if (patch.enabled !== undefined) valueSet.enabled = patch.enabled;
  if (patch.allowed_tools !== undefined) valueSet.allowed_tools = patch.allowed_tools;
  if (patch.channel_subscriptions !== undefined) {
    valueSet.channel_subscriptions = patch.channel_subscriptions;
  }
  if (patch.rate_limit_override !== undefined) {
    valueSet.rate_limit_override = patch.rate_limit_override;
  }
  if (patch.notes !== undefined) valueSet.notes = patch.notes;

  if (existing) {
    await db
      .update(agentPolicies)
      .set(valueSet)
      .where(eq(agentPolicies.agent_user_id, agent_user_id));
  } else {
    // New rows need org_id, enabled, allowed_tools defaults.
    await db.insert(agentPolicies).values({
      agent_user_id,
      org_id: target.org_id,
      enabled: patch.enabled ?? true,
      allowed_tools: patch.allowed_tools ?? ['*'],
      channel_subscriptions: patch.channel_subscriptions ?? [],
      rate_limit_override: patch.rate_limit_override ?? null,
      notes: patch.notes ?? null,
      updated_by: actor.id,
    });
  }

  const after = await getPolicy(agent_user_id);
  if (!after) {
    // Shouldn't happen post-upsert, but keep the type safe.
    return { error: 'NOT_AN_AGENT' };
  }

  // Publish invalidation so live MCP sessions drop the cache entry. Fire
  // and forget; a Redis outage degrades to TTL-only invalidation (5s).
  if (redis) {
    try {
      await redis.publish(REDIS_INVALIDATE_CHANNEL, agent_user_id);
    } catch {
      // Intentionally swallowed: the caller already committed the write.
    }
  }

  return { ...after, confirmation_required: willDisable };
}

/**
 * List policies for an org, joined with `agent_runners` so the UI can show
 * liveness (last_heartbeat_at) alongside the enabled/allowed-tools state.
 * `enabled_only=true` returns only disabled rows (inverted sense; the flag
 * name matches the intuition "show me who is currently disabled and needs
 * attention" — the spec uses `enabled_only` to mean "filter by the enabled
 * dimension"; callers pass `enabled_only=true` to get the currently-
 * enabled-false set). Kept defensive: accept both interpretations via an
 * explicit `enabled` tri-state if future callers want it.
 */
export async function listPolicies(
  org_id: string,
  opts: { enabled_only?: boolean } = {},
): Promise<ListPolicyRow[]> {
  const conditions = [eq(agentPolicies.org_id, org_id)];
  if (opts.enabled_only === true) {
    conditions.push(eq(agentPolicies.enabled, true));
  }

  const rows = await db
    .select({
      agent_user_id: agentPolicies.agent_user_id,
      agent_name: users.display_name,
      enabled: agentPolicies.enabled,
      allowed_tools: agentPolicies.allowed_tools,
      updated_at: agentPolicies.updated_at,
      last_heartbeat_at: agentRunners.last_heartbeat_at,
    })
    .from(agentPolicies)
    .leftJoin(users, eq(agentPolicies.agent_user_id, users.id))
    .leftJoin(agentRunners, eq(agentRunners.user_id, agentPolicies.agent_user_id))
    .where(and(...conditions))
    .orderBy(sql`${agentPolicies.enabled} ASC`, sql`${agentPolicies.updated_at} DESC`);

  return rows.map((r) => ({
    agent_user_id: r.agent_user_id,
    agent_name: r.agent_name ?? '',
    enabled: r.enabled,
    allowed_tool_count: (r.allowed_tools as string[]).length,
    last_heartbeat_at: r.last_heartbeat_at ? r.last_heartbeat_at.toISOString() : null,
    updated_at: r.updated_at.toISOString(),
  }));
}

/**
 * Canonical "may this agent run this tool?" check. Called by the MCP
 * register-tool wrapper on every service-account invocation. Returns
 * `allowed: false` with a reason code the wrapper surfaces verbatim.
 *
 * Behavior when there is NO row for the agent: we return allowed:false
 * (AGENT_DISABLED). The migration backfills every existing agent, so a miss
 * means either the agent was created after 0139 without its default policy
 * being inserted (operator error — explicit deny is safer than implicit
 * allow) or the agent_user_id does not exist.
 */
export async function checkPolicy(
  agent_user_id: string,
  tool_name: string,
): Promise<CheckResult> {
  const policy = await getPolicy(agent_user_id);
  if (!policy) {
    return {
      allowed: false,
      reason: 'AGENT_DISABLED',
      agent_user_id,
      disabled_at: null,
      contact: null,
    };
  }
  if (!policy.enabled) {
    return {
      allowed: false,
      reason: 'AGENT_DISABLED',
      agent_user_id,
      disabled_at: policy.updated_at.toISOString(),
      contact: policy.updated_by_user?.name ?? null,
    };
  }
  if (!isToolAllowed(policy.allowed_tools, tool_name)) {
    return {
      allowed: false,
      reason: 'TOOL_NOT_ALLOWED',
      agent_user_id,
      disabled_at: null,
      contact: policy.updated_by_user?.name ?? null,
    };
  }
  return { allowed: true };
}

// Test harness export.
export const __test__ = {
  normalize,
  REDIS_INVALIDATE_CHANNEL,
};
