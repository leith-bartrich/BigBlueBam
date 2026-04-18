/**
 * Agent webhook dispatch hook (AGENTIC_TODO §20, Wave 5).
 *
 * Runs inside the bolt-api `POST /events/ingest` handler right after
 * rule evaluation. For every webhook-enabled runner in the same org
 * whose event_filter matches the current (source, event_type), inserts
 * a row into `agent_webhook_deliveries` (status=pending, attempt=0)
 * and enqueues a BullMQ `agent-webhook-dispatch` job. The worker
 * (apps/worker/src/jobs/agent-webhook-dispatch.job.ts) picks up the row
 * and performs the actual outbound POST.
 *
 * Policy gating: the join against `agent_policies.enabled` filters out
 * runners whose policy row has been flipped off. Runners with NO policy
 * row pass (fail-open at the dispatcher level — the MCP tool gate is
 * still fail-closed on its own layer). This matches the plan's
 * "dispatcher gate reads agent_policies.enabled first" requirement.
 *
 * This hook is fire-and-forget from the ingest path's perspective: it
 * catches its own errors so the primary rule evaluation flow never
 * degrades because a webhook enqueue failed.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { db } from '../db/index.js';

// ---------------------------------------------------------------------------
// Local schema stubs. Mirror the columns owned by migration 0140 so this
// service can read from / write to agent_runners and
// agent_webhook_deliveries without importing from apps/api.
// ---------------------------------------------------------------------------

const agentRunners = pgTable('agent_runners', {
  id: uuid('id').primaryKey(),
  org_id: uuid('org_id').notNull(),
  user_id: uuid('user_id').notNull(),
  webhook_url: text('webhook_url'),
  webhook_enabled: boolean('webhook_enabled').notNull(),
  webhook_event_filter: jsonb('webhook_event_filter').notNull(),
});

const agentPolicies = pgTable('agent_policies', {
  agent_user_id: uuid('agent_user_id').primaryKey(),
  enabled: boolean('enabled').notNull(),
});

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

// ---------------------------------------------------------------------------
// Event filter matcher (duplicated from apps/api so this file has no
// cross-app runtime dependency; semantics are identical).
// ---------------------------------------------------------------------------

export function eventMatchesFilter(
  filter: string[],
  source: string,
  eventType: string,
): boolean {
  if (filter.length === 0) return false;
  for (const entry of filter) {
    if (entry === '*') return true;
    const colon = entry.indexOf(':');
    if (colon < 0) continue;
    const entrySource = entry.slice(0, colon);
    const entryEvent = entry.slice(colon + 1);
    if (entrySource !== source) continue;
    if (entryEvent === '*') return true;
    if (entryEvent === eventType) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Queue (lazy, module-level)
// ---------------------------------------------------------------------------

let _dispatchQueue: Queue | null = null;

function getDispatchQueue(redis: Redis): Queue {
  if (!_dispatchQueue) {
    _dispatchQueue = new Queue('agent-webhook-dispatch', { connection: redis });
  }
  return _dispatchQueue;
}

// ---------------------------------------------------------------------------
// Hook entry point
// ---------------------------------------------------------------------------

export interface DispatchToSubscribedRunnersInput {
  orgId: string;
  eventId: string;
  source: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Fan out an event to every subscribed, enabled agent runner in the
 * same org. Returns the number of deliveries enqueued. Never throws;
 * logs errors at warn level and returns 0 on failure so the ingest
 * path is unaffected.
 */
export async function dispatchToSubscribedRunners(
  redis: Redis,
  input: DispatchToSubscribedRunnersInput,
  logger: FastifyBaseLogger,
): Promise<number> {
  try {
    const rows = await db
      .select({
        runner_id: agentRunners.id,
        user_id: agentRunners.user_id,
        org_id: agentRunners.org_id,
        webhook_url: agentRunners.webhook_url,
        webhook_enabled: agentRunners.webhook_enabled,
        webhook_event_filter: agentRunners.webhook_event_filter,
        agent_policy_enabled: agentPolicies.enabled,
      })
      .from(agentRunners)
      .leftJoin(agentPolicies, eq(agentPolicies.agent_user_id, agentRunners.user_id))
      .where(
        and(
          eq(agentRunners.org_id, input.orgId),
          eq(agentRunners.webhook_enabled, true),
        ),
      );

    if (rows.length === 0) return 0;

    const queue = getDispatchQueue(redis);
    let enqueued = 0;

    for (const r of rows) {
      if (!r.webhook_url) continue;
      if (r.agent_policy_enabled === false) continue; // §15 kill-switch

      const filter = r.webhook_event_filter as unknown;
      if (!Array.isArray(filter)) continue;
      if (!eventMatchesFilter(filter as string[], input.source, input.eventType)) {
        continue;
      }

      const deliveryId = randomUUID();
      try {
        await db.insert(agentWebhookDeliveries).values({
          id: deliveryId,
          org_id: r.org_id,
          runner_id: r.runner_id,
          event_id: input.eventId,
          event_source: input.source,
          event_type: input.eventType,
          payload: input.payload,
          status: 'pending',
          attempt_count: 0,
          created_at: new Date(),
          next_retry_at: new Date(),
        });

        await queue.add(
          'dispatch',
          { delivery_id: deliveryId },
          {
            attempts: 1,
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        );

        enqueued++;
      } catch (err) {
        logger.warn(
          { err, runner_id: r.runner_id, event_id: input.eventId },
          'agent-webhook-dispatch: failed to enqueue delivery',
        );
      }
    }

    if (enqueued > 0) {
      logger.info(
        {
          event_id: input.eventId,
          source: input.source,
          event_type: input.eventType,
          enqueued,
        },
        'agent-webhook-dispatch: fanned out to subscribed runners',
      );
    }

    return enqueued;
  } catch (err) {
    logger.warn(
      { err, event_id: input.eventId },
      'agent-webhook-dispatch: hook failed; skipping webhook fan-out',
    );
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Test harness export
// ---------------------------------------------------------------------------

export const __test__ = {
  eventMatchesFilter,
};
