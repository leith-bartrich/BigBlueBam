import { pgTable, uuid, boolean, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { users } from './users.js';

/**
 * Agent policies (AGENTIC_TODO §15, Wave 5, migration 0139).
 *
 * One row per agent/service user. Drives the fail-closed policy check the
 * MCP `register-tool` wrapper runs on every tool invocation by a service
 * account (see apps/mcp-server/src/lib/register-tool.ts). The row is also
 * the canonical kill-switch: flipping `enabled = false` disables the agent
 * at the platform level, and the MCP session listener publishes a
 * Redis PubSub message on `agent_policies:invalidate` so live sessions
 * can self-close (listener implementation is out of scope for Wave 5).
 *
 * Semantics:
 *   - `allowed_tools` is a glob-prefix allowlist. The single entry `'*'`
 *     means allow all tools; otherwise an entry like `banter.*` matches
 *     any tool name starting with `banter.` (or equals `banter`). Core
 *     tools (`get_server_info`, `get_me`, `agent_heartbeat`) are always
 *     permitted regardless of this list — see register-tool.ts.
 *   - `channel_subscriptions` is reserved for Wave 5 §1 subscription
 *     wiring; not read by the policy-check middleware.
 *   - `rate_limit_override` is reserved for Wave 5 rate-limiter work;
 *     Wave 5 §15 does not wire it through.
 */
export const agentPolicies = pgTable(
  'agent_policies',
  {
    agent_user_id: uuid('agent_user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').default(true).notNull(),
    allowed_tools: text('allowed_tools')
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    channel_subscriptions: uuid('channel_subscriptions')
      .array()
      .default(sql`'{}'::uuid[]`)
      .notNull(),
    rate_limit_override: integer('rate_limit_override'),
    notes: text('notes'),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updated_by: uuid('updated_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    index('idx_agent_policies_org').on(table.org_id),
    // Partial index; the Drizzle index builder ignores WHERE so we only
    // declare the presence of the index here and the migration carries
    // the `WHERE enabled = false` predicate.
    index('idx_agent_policies_enabled').on(table.enabled),
  ],
);
