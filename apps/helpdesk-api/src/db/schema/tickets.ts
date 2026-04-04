import { pgTable, uuid, varchar, text, serial, timestamp, index } from 'drizzle-orm/pg-core';
import { helpdeskUsers } from './helpdesk-users.js';
import { tasks, projects } from './bbb-refs.js';

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
  },
  (table) => [
    index('tickets_helpdesk_user_id_idx').on(table.helpdesk_user_id),
    index('tickets_task_id_idx').on(table.task_id),
    index('tickets_status_idx').on(table.status),
  ],
);
