/**
 * Minimal Drizzle table declarations for bolt_automations and bolt_actions.
 *
 * These are lean stubs — only the columns the worker actually reads.  They
 * mirror the canonical schema in apps/bolt-api/src/db/schema/ but live here
 * so the worker stays self-contained (it is a separate Docker container and
 * cannot import from apps/bolt-api at runtime).
 *
 * If you add a column to bolt_automations or bolt_actions in bolt-api and the
 * worker needs to read it, add it here too (and update getAutomationForExecution
 * in apps/bolt-api/src/services/automation.service.ts in parallel).
 */

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

export const boltAutomations = pgTable('bolt_automations', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  max_chain_depth: integer('max_chain_depth').default(5).notNull(),
  created_by: uuid('created_by').notNull(),
  template_strict: boolean('template_strict').default(false).notNull(),
});

export const boltActions = pgTable('bolt_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  automation_id: uuid('automation_id').notNull(),
  sort_order: integer('sort_order').notNull(),
  mcp_tool: varchar('mcp_tool', { length: 100 }).notNull(),
  parameters: jsonb('parameters'),
  on_error: varchar('on_error', { length: 20 }).default('stop').notNull(),
  retry_count: integer('retry_count').default(0).notNull(),
  retry_delay_ms: integer('retry_delay_ms').default(1000).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
