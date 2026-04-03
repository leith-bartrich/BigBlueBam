import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

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
