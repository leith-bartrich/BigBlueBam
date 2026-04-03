import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { banterCalls } from './calls.js';

export const banterCallParticipants = pgTable(
  'banter_call_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    call_id: uuid('call_id')
      .notNull()
      .references(() => banterCalls.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: varchar('role', { length: 20 }).notNull().default('participant'),
    joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    left_at: timestamp('left_at', { withTimezone: true }),
    duration_seconds: integer('duration_seconds'),
    has_audio: boolean('has_audio').notNull().default(true),
    has_video: boolean('has_video').notNull().default(false),
    has_screen_share: boolean('has_screen_share').notNull().default(false),
    is_bot: boolean('is_bot').notNull().default(false),
    participation_mode: varchar('participation_mode', { length: 20 }).notNull().default('media'),
  },
  (table) => [
    uniqueIndex('banter_call_participants_unique_idx').on(
      table.call_id,
      table.user_id,
      table.joined_at,
    ),
    index('banter_call_participants_call_idx').on(table.call_id),
  ],
);
