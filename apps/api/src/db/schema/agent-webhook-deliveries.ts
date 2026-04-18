import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { agentRunners } from './agent-runners.js';

/**
 * Agent webhook deliveries (AGENTIC_TODO §20, Wave 5, migration 0140).
 *
 * One row per (runner, event) pair enqueued by the dispatcher hook. The
 * BullMQ `agent-webhook-dispatch` worker reads the row, signs the
 * payload with the runner's per-runner secret, POSTs to the URL, and
 * updates status to `delivered` / `failed` / `dead_lettered`. The DLQ
 * worker picks up dead-lettered rows for operator attention.
 *
 * Status machine:
 *   pending      → dispatcher picked it up; attempt_count starts at 0
 *   delivered    → 2xx response; delivered_at set; terminal
 *   failed       → non-2xx or network error; next_retry_at set per
 *                  the Wave 5 backoff schedule
 *                  (0s, 30s, 2m, 10m, 30m, 2h, 6h)
 *   dead_lettered → attempt 8 failed; terminal
 */
export const agentWebhookDeliveries = pgTable(
  'agent_webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    runner_id: uuid('runner_id')
      .notNull()
      .references(() => agentRunners.id, { onDelete: 'cascade' }),
    event_id: uuid('event_id').notNull(),
    event_source: text('event_source').notNull(),
    event_type: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull(),
    attempt_count: integer('attempt_count').default(0).notNull(),
    last_attempt_at: timestamp('last_attempt_at', { withTimezone: true }),
    last_error: text('last_error'),
    response_status_code: integer('response_status_code'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    delivered_at: timestamp('delivered_at', { withTimezone: true }),
    next_retry_at: timestamp('next_retry_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_agent_webhook_deliv_runner').on(table.runner_id, table.created_at),
    // Partial indexes for pending + DLQ declared in the migration; Drizzle
    // index builder ignores WHERE, so we only record presence.
    index('idx_agent_webhook_deliv_pending').on(table.next_retry_at),
    index('idx_agent_webhook_deliv_dlq').on(table.status),
    index('idx_agent_webhook_deliv_org_created').on(table.org_id, table.created_at),
  ],
);

export type AgentWebhookDelivery = typeof agentWebhookDeliveries.$inferSelect;
export type AgentWebhookDeliveryInsert = typeof agentWebhookDeliveries.$inferInsert;
