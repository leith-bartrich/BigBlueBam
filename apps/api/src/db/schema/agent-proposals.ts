import { pgTable, pgEnum, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { users, actorTypeEnum } from './users.js';

/**
 * Durable agent-proposal queue (AGENTIC_TODO §9, migration 0128).
 *
 * Replaces the ad-hoc Banter-thread / task-comment HITL patterns (and subsumes
 * the Blast-specific `require_human_approval` flag) with a single inbox where
 * humans can see "what am I being asked to approve?" across the whole suite.
 *
 * Lifecycle: pending -> approved | rejected | revising | expired | revoked.
 * Only pending and revising proposals are decidable. expires_at is required
 * (no nullable TTL) so the expiry sweep worker can always make progress.
 *
 * RLS: org-isolated via `current_setting('app.current_org_id', true)::uuid`.
 */
export const proposalStatusEnum = pgEnum('proposal_status', [
  'pending',
  'approved',
  'rejected',
  'expired',
  'revoked',
  'revising',
]);

export const agentProposals = pgTable(
  'agent_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actor_id: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    proposer_kind: actorTypeEnum('proposer_kind').notNull(),
    proposed_action: text('proposed_action').notNull(),
    proposed_payload: jsonb('proposed_payload').default({}).notNull(),
    subject_type: text('subject_type'),
    subject_id: uuid('subject_id'),
    approver_id: uuid('approver_id').references(() => users.id, { onDelete: 'set null' }),
    status: proposalStatusEnum('status').default('pending').notNull(),
    decided_at: timestamp('decided_at', { withTimezone: true }),
    decision_reason: text('decision_reason'),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_agent_proposals_approver_status').on(table.approver_id, table.status),
    index('idx_agent_proposals_org_status_created').on(table.org_id, table.status, table.created_at),
    index('idx_agent_proposals_actor_created').on(table.actor_id, table.created_at),
    index('idx_agent_proposals_expires_pending').on(table.expires_at),
  ],
);
