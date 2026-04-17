import { type AnyPgColumn, pgTable, uuid, varchar, text, serial, timestamp, index, customType } from 'drizzle-orm/pg-core';
import { helpdeskUsers } from './helpdesk-users.js';
import { tasks, projects, users } from './bbb-refs.js';

// Custom tsvector type. Drizzle has no first-class tsvector column kind
// and we only ever read/exclude this column, never hand-build a value for
// it (the DB populates it via a GENERATED ALWAYS AS expression added by
// migration 0112).
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ============================================================================
// HB-21: DUAL SCHEMA — KEEP IN SYNC
// ----------------------------------------------------------------------------
// This is the helpdesk-api's FULLER view of the `tickets` postgres table
// (all columns the helpdesk service reads/writes). A minimal view lives in:
//
//   apps/api/src/db/schema/tickets.ts
//
// Both Drizzle schemas describe the SAME underlying postgres table. Until
// both services share a common schema package, any column addition/removal
// or type change on the physical table MUST be reflected in both files to
// avoid runtime drift (missing columns on select, write errors, etc.).
//
// Columns referenced here:
//   tickets: id, ticket_number, helpdesk_user_id, task_id, project_id,
//            subject, description, status, priority, category, created_at,
//            updated_at, resolved_at, closed_at,
//            duplicate_of, merged_at, merged_by (HB-55)
// ============================================================================

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_number: serial('ticket_number').unique(),
    // HB-11: CASCADE on helpdesk_user_id — deleting a customer removes their tickets
    // to preserve referential integrity (vs. orphaning them with RESTRICT/SET NULL).
    helpdesk_user_id: uuid('helpdesk_user_id')
      .notNull()
      .references(() => helpdeskUsers.id, { onDelete: 'cascade' }),
    // HB-56: SET NULL on task_id — Tickets preserve history even after their task is deleted.
    task_id: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    project_id: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    subject: varchar('subject', { length: 500 }).notNull(),
    description: text('description').notNull(),
    status: varchar('status', { length: 50 }).default('open').notNull(),
    priority: varchar('priority', { length: 20 }).default('medium').notNull(),
    category: varchar('category', { length: 100 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    resolved_at: timestamp('resolved_at', { withTimezone: true }),
    closed_at: timestamp('closed_at', { withTimezone: true }),
    // G4 / SLA tracking (migration 0111). first_response_at stamps when the
    // first agent public reply lands. sla_breached_at is written by the
    // out-of-scope worker sweeper; kept in the schema so the column is
    // available to dashboards and search filters.
    first_response_at: timestamp('first_response_at', { withTimezone: true }),
    sla_breached_at: timestamp('sla_breached_at', { withTimezone: true }),
    // G5 / full-text search (migration 0112). Generated tsvector derived
    // from subject (weight A) and description (weight B). Excluded from
    // SELECT * lists where we just need column-by-column projection.
    search_vector: tsvector('search_vector'),
    // HB-55: duplicate/merge support. duplicate_of is a self-FK; the typed
    // back-reference requires the AnyPgColumn cast for Drizzle's type
    // checker. See migration 0016_ticket_duplicates.sql for the index and
    // FK semantics (ON DELETE SET NULL on both FKs).
    duplicate_of: uuid('duplicate_of').references((): AnyPgColumn => tickets.id, { onDelete: 'set null' }),
    merged_at: timestamp('merged_at', { withTimezone: true }),
    merged_by: uuid('merged_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('tickets_helpdesk_user_id_idx').on(table.helpdesk_user_id),
    index('tickets_task_id_idx').on(table.task_id),
    index('tickets_status_idx').on(table.status),
    index('idx_tickets_duplicate_of').on(table.duplicate_of),
    index('idx_tickets_first_response_at').on(table.first_response_at),
    index('idx_tickets_sla_breached_at').on(table.sla_breached_at),
  ],
);
