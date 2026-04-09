import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { bookCalendars } from './book-calendars.js';

export const bookIcalTokens = pgTable(
  'book_ical_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    calendar_id: uuid('calendar_id')
      .notNull()
      .references(() => bookCalendars.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_book_ical_tokens_token').on(table.token)],
);
