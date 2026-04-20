import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { users } from './users.js';

/**
 * Agent runners (AGENTIC_TODO §10, migration 0127). One row per service-account
 * user that has ever heartbeat'd. `last_heartbeat_at` is bumped on every
 * `POST /v1/agents/heartbeat` call; a NULL value means the runner has been
 * registered but has not heartbeat'd since the column was introduced.
 *
 * §20 Wave 5 webhooks (migration 0140): the webhook_* columns drive outbound
 * push delivery of Bolt events to external runners.
 *   - webhook_url             https:// endpoint the dispatcher POSTs to.
 *   - webhook_secret_hash     argon2id hash of the per-runner HMAC secret.
 *                             Plaintext is returned exactly once at
 *                             configure/rotate time; there is no re-reveal.
 *   - webhook_event_filter    JSON array of "source:event_type" strings; an
 *                             empty array means "no subscriptions" (skip).
 *   - webhook_consecutive_failures  used by the circuit breaker. At >= 20
 *                             the dispatcher auto-disables the hook and
 *                             emits `agent.webhook.disabled`.
 *
 * TODO (Wave 2): derive liveness from `last_heartbeat_at` with a configurable
 * TTL (proposed default 5 minutes) and surface an `is_alive` boolean on list
 * endpoints. Wave 1 stores the timestamp only.
 */
export const agentRunners = pgTable(
  'agent_runners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    version: text('version'),
    capabilities: jsonb('capabilities').default([]).notNull(),
    last_heartbeat_at: timestamp('last_heartbeat_at', { withTimezone: true }),
    first_seen_at: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    // §20 Wave 5 webhooks
    webhook_url: text('webhook_url'),
    webhook_secret_hash: text('webhook_secret_hash'),
    webhook_event_filter: jsonb('webhook_event_filter').default([]).notNull(),
    webhook_last_success_at: timestamp('webhook_last_success_at', { withTimezone: true }),
    webhook_last_failure_at: timestamp('webhook_last_failure_at', { withTimezone: true }),
    webhook_consecutive_failures: integer('webhook_consecutive_failures').default(0).notNull(),
    webhook_enabled: boolean('webhook_enabled').default(false).notNull(),
  },
  (table) => [
    uniqueIndex('agent_runners_user_id_uniq').on(table.user_id),
    index('idx_agent_runners_org_id').on(table.org_id),
    index('idx_agent_runners_last_heartbeat').on(table.last_heartbeat_at),
    // §20 Wave 5: partial index (WHERE webhook_enabled = true) declared
    // in the migration; Drizzle index builder ignores WHERE, so we only
    // record the presence here.
    index('idx_agent_runners_webhook_enabled').on(table.org_id),
  ],
);
