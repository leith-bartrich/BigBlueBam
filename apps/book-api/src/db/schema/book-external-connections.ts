import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';

export const bookExternalConnections = pgTable(
  'book_external_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 20 }).notNull(),
    access_token: text('access_token').notNull(),
    refresh_token: text('refresh_token'),
    token_expires_at: timestamp('token_expires_at', { withTimezone: true }),
    external_calendar_id: varchar('external_calendar_id', { length: 255 }).notNull(),
    sync_direction: varchar('sync_direction', { length: 10 }).notNull().default('both'),
    last_sync_at: timestamp('last_sync_at', { withTimezone: true }),
    sync_status: varchar('sync_status', { length: 20 }).notNull().default('active'),
    sync_error: text('sync_error'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_book_ext_user').on(table.user_id)],
);
