import {
  pgTable,
  uuid,
  varchar,
  smallint,
  time,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';

export const bookWorkingHours = pgTable(
  'book_working_hours',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day_of_week: smallint('day_of_week').notNull(),
    start_time: time('start_time').notNull(),
    end_time: time('end_time').notNull(),
    timezone: varchar('timezone', { length: 50 }).notNull().default('UTC'),
    enabled: boolean('enabled').notNull().default(true),
  },
  (table) => [
    uniqueIndex('book_working_hours_user_day_idx').on(table.user_id, table.day_of_week),
  ],
);
