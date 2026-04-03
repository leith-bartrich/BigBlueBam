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
import { banterChannels } from './channels.js';
import { banterMessages } from './messages.js';

export const banterChannelMemberships = pgTable(
  'banter_channel_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel_id: uuid('channel_id')
      .notNull()
      .references(() => banterChannels.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull().default('member'),
    notifications: varchar('notifications', { length: 20 }).notNull().default('default'),
    is_muted: boolean('is_muted').notNull().default(false),
    joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    last_read_message_id: uuid('last_read_message_id').references(() => banterMessages.id, {
      onDelete: 'set null',
    }),
    last_read_at: timestamp('last_read_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('banter_channel_memberships_unique_idx').on(table.channel_id, table.user_id),
    index('banter_channel_memberships_user_idx').on(table.user_id),
    index('banter_channel_memberships_channel_idx').on(table.channel_id),
  ],
);
