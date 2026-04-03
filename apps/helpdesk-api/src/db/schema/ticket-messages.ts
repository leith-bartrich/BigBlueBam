import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { tickets } from './tickets.js';

export const ticketMessages = pgTable(
  'ticket_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_id: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    author_type: varchar('author_type', { length: 20 }).notNull(),
    author_id: uuid('author_id').notNull(),
    author_name: varchar('author_name', { length: 100 }).notNull(),
    body: text('body').notNull(),
    is_internal: boolean('is_internal').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ticket_messages_ticket_created_idx').on(table.ticket_id, table.created_at),
  ],
);
