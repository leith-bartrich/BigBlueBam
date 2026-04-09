import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { boards } from './boards.js';
import { users } from './bbb-refs.js';

export const boardChatMessages = pgTable(
  'board_chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    board_id: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    author_id: uuid('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_board_chat_messages_board_created').on(table.board_id, table.created_at),
  ],
);
