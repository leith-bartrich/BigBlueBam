import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { banterMessages } from './messages.js';

export const banterMessageReactions = pgTable(
  'banter_message_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    message_id: uuid('message_id')
      .notNull()
      .references(() => banterMessages.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: varchar('emoji', { length: 50 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('banter_message_reactions_unique_idx').on(
      table.message_id,
      table.user_id,
      table.emoji,
    ),
    index('banter_message_reactions_message_idx').on(table.message_id),
  ],
);
