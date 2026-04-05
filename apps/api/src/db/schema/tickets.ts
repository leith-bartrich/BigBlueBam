import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

// ============================================================================
// HB-21: DUAL SCHEMA — KEEP IN SYNC
// ----------------------------------------------------------------------------
// This is the B3 API's MINIMAL view of the `tickets` / `ticket_messages`
// postgres tables (only the columns B3 needs to read/write). A fuller view
// lives in:
//
//   apps/helpdesk-api/src/db/schema/tickets.ts
//
// Both Drizzle schemas describe the SAME underlying postgres tables. Until
// both services share a common schema package, any column addition/removal
// or type change on the physical table MUST be reflected in both files to
// avoid runtime drift (missing columns on select, write errors, etc.).
//
// Columns referenced here:
//   tickets: id, task_id, status, resolved_at
//   ticket_messages: id, ticket_id, author_type, author_id, author_name,
//                    body, is_internal, created_at
// ============================================================================

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_id: uuid('task_id'),
  status: varchar('status', { length: 50 }).default('open').notNull(),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
});

export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticket_id: uuid('ticket_id').notNull(),
  author_type: varchar('author_type', { length: 20 }).notNull(),
  author_id: uuid('author_id').notNull(),
  author_name: varchar('author_name', { length: 100 }).notNull(),
  body: text('body').notNull(),
  is_internal: boolean('is_internal').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
