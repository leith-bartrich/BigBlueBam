/**
 * Agent webhook dead-letter scanner (AGENTIC_TODO §20, Wave 5).
 *
 * Periodic sweep that surfaces recently dead-lettered deliveries so
 * operators see them on the unified activity feed. The dispatch job
 * itself marks rows as `dead_lettered` on attempt 8; this sweeper is a
 * notifier, not a re-driver. Runs every 5 minutes and emits
 * `agent.webhook.dead_lettered` bolt events for rows that tipped into
 * DLQ inside the sweep window.
 *
 * Idempotency: BullMQ jobId is derived from the delivery id, so
 * overlapping sweeps dedupe at the queue layer; on top of that the
 * sweeper only scans rows whose last_attempt_at is inside a 60-minute
 * window, so the re-notification blast radius is bounded.
 *
 * Dead-lettered rows are retained in the DB for operator triage and
 * redelivery. A longer-cadence pruner can retire them later; Wave 5
 * does not automate deletion.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { and, eq, gte } from 'drizzle-orm';
import { pgTable, uuid, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import { getDb } from '../utils/db.js';
import { publishBoltEvent } from '../utils/bolt-events.js';

const agentWebhookDeliveries = pgTable('agent_webhook_deliveries', {
  id: uuid('id').primaryKey(),
  org_id: uuid('org_id').notNull(),
  runner_id: uuid('runner_id').notNull(),
  event_id: uuid('event_id').notNull(),
  event_source: text('event_source').notNull(),
  event_type: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull(),
  attempt_count: integer('attempt_count').notNull(),
  last_attempt_at: timestamp('last_attempt_at', { withTimezone: true }),
  last_error: text('last_error'),
  response_status_code: integer('response_status_code'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
  delivered_at: timestamp('delivered_at', { withTimezone: true }),
  next_retry_at: timestamp('next_retry_at', { withTimezone: true }),
});

// Sweep window (minutes). Rows that went to DLQ more than this long ago
// are considered already-triaged and are not re-notified.
const SWEEP_WINDOW_MINUTES = 15;
const SCAN_LIMIT = 500;

export interface AgentWebhookDlqJobData {
  // Unused currently; reserved for targeted operator runs.
  org_id?: string;
}

export async function processAgentWebhookDlqJob(
  _job: Job<AgentWebhookDlqJobData>,
  logger: Logger,
): Promise<void> {
  const db = getDb();

  const horizon = new Date(Date.now() - SWEEP_WINDOW_MINUTES * 60_000);

  const rows = await db
    .select()
    .from(agentWebhookDeliveries)
    .where(
      and(
        eq(agentWebhookDeliveries.status, 'dead_lettered'),
        gte(agentWebhookDeliveries.last_attempt_at, horizon),
      ),
    )
    .limit(SCAN_LIMIT);

  if (rows.length === 0) {
    logger.debug('agent-webhook-dlq: no new dead-lettered rows in sweep window');
    return;
  }

  logger.warn(
    { count: rows.length, windowMinutes: SWEEP_WINDOW_MINUTES },
    'agent-webhook-dlq: surfacing dead-lettered deliveries',
  );

  for (const row of rows) {
    await publishBoltEvent(
      'agent.webhook.dead_lettered',
      'platform',
      {
        delivery_id: row.id,
        runner_id: row.runner_id,
        event_id: row.event_id,
        event_source: row.event_source,
        event_type: row.event_type,
        attempt_count: row.attempt_count,
        last_error: row.last_error,
        response_status_code: row.response_status_code,
      },
      row.org_id,
    );
  }
}
