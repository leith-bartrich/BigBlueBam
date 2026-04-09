import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { bookExternalConnections } from './book-external-connections.js';

export const bookExternalEvents = pgTable(
  'book_external_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connection_id: uuid('connection_id')
      .notNull()
      .references(() => bookExternalConnections.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    external_event_id: varchar('external_event_id', { length: 255 }).notNull(),
    title: varchar('title', { length: 500 }),
    start_at: timestamp('start_at', { withTimezone: true }).notNull(),
    end_at: timestamp('end_at', { withTimezone: true }).notNull(),
    all_day: boolean('all_day').notNull().default(false),
    visibility: varchar('visibility', { length: 20 }).notNull().default('busy'),
    synced_at: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('book_ext_events_conn_ext_idx').on(table.connection_id, table.external_event_id),
    index('idx_book_ext_events_user').on(table.user_id, table.start_at, table.end_at),
  ],
);
