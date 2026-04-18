import { pgView, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Unified activity view (AGENTIC_TODO §5, migration 0129).
 *
 * UNION ALL over Bam activity_log, bond_activities, and ticket_activity_log.
 * Exposes a normalized column set that agent-facing tools can query without
 * knowing which source table a row came from.
 *
 * ---------------------------------------------------------------------------
 * LANDMINE: actor_type remap (DO NOT CONFUSE)
 * ---------------------------------------------------------------------------
 * The three source tables speak different vocabularies:
 *
 *   activity_log          actor_type ∈ {human, agent, service}        (platform)
 *   bond_activities       no actor_type column; derived from users.kind
 *                         or 'service' when performed_by IS NULL
 *   ticket_activity_log   actor_type ∈ {customer, agent, system}      (helpdesk)
 *
 * The helpdesk 'agent' label means HUMAN SUPPORT AGENT, NOT AI agent. The
 * view remaps:
 *
 *   helpdesk 'customer' -> 'human'
 *   helpdesk 'agent'    -> 'human'    (NOT 'agent' — that would be wrong)
 *   helpdesk 'system'   -> 'service'
 *
 * See infra/postgres/migrations/0129_activity_unified_view.sql for the SQL
 * body and the full explanation.
 *
 * ---------------------------------------------------------------------------
 * Drizzle drift-guard note
 * ---------------------------------------------------------------------------
 * scripts/db-check.mjs only parses pgTable declarations. pgView declarations
 * are invisible to it, which means:
 *   - This file will NOT trigger false-positive drift on the view body.
 *   - Breaking changes to the view's column shape will NOT be caught by
 *     db:check; they have to be validated through integration tests or a
 *     manual \d+ v_activity_unified on the live DB.
 *
 * The trade-off is acceptable in Wave 3 because the view is read-only and
 * consumed only by the activity-unified.service layer.
 */
export const vActivityUnified = pgView('v_activity_unified', {
  id: uuid('id').notNull(),
  source_app: text('source_app').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: uuid('entity_id'),
  project_id: uuid('project_id'),
  organization_id: uuid('organization_id'),
  actor_id: uuid('actor_id'),
  actor_type: text('actor_type').notNull(),
  action: text('action').notNull(),
  details: jsonb('details'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
}).existing();

// Re-export the SQL expression for raw-query paths that cannot use the
// typed view reference (used by the unified service when composing the
// composite WHERE with per-source EXISTS gates).
export const V_ACTIVITY_UNIFIED = sql`v_activity_unified`;
