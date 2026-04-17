import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './bbb-refs.js';
import { banterChannels } from './channels.js';

/**
 * Real-time user presence (online / idle / in_call / dnd / offline).
 * One row per user. Migration: 0105_banter_user_presence.sql.
 */
export const banterUserPresence = pgTable(
  'banter_user_presence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('offline'),
    in_call_channel_id: uuid('in_call_channel_id').references(
      () => banterChannels.id,
      { onDelete: 'set null' },
    ),
    custom_status_text: varchar('custom_status_text', { length: 200 }),
    custom_status_emoji: varchar('custom_status_emoji', { length: 10 }),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    last_activity_at: timestamp('last_activity_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_banter_user_presence_user').on(table.user_id),
    index('idx_banter_user_presence_status').on(table.status),
    check(
      'banter_user_presence_status_check',
      sql`status IN ('online', 'idle', 'in_call', 'dnd', 'offline')`,
    ),
  ],
);

export type BanterPresenceStatus =
  | 'online'
  | 'idle'
  | 'in_call'
  | 'dnd'
  | 'offline';
