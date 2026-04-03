import { pgTable, uuid, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { banterChannels } from './channels.js';
import { banterMessages } from './messages.js';

export const banterPins = pgTable(
  'banter_pins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel_id: uuid('channel_id')
      .notNull()
      .references(() => banterChannels.id, { onDelete: 'cascade' }),
    message_id: uuid('message_id')
      .notNull()
      .references(() => banterMessages.id, { onDelete: 'cascade' }),
    pinned_by: uuid('pinned_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('banter_pins_unique_idx').on(table.channel_id, table.message_id),
    index('banter_pins_channel_idx').on(table.channel_id),
  ],
);
