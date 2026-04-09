import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { bookEvents } from './book-events.js';

export const bookEventAttendees = pgTable(
  'book_event_attendees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event_id: uuid('event_id')
      .notNull()
      .references(() => bookEvents.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 200 }),
    response_status: varchar('response_status', { length: 20 }).notNull().default('needs_action'),
    is_organizer: boolean('is_organizer').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_book_attendees_event').on(table.event_id),
    index('idx_book_attendees_user').on(table.user_id),
  ],
);
