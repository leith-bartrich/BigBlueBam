import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { boards } from './boards.js';
import { users } from './bbb-refs.js';

export const boardCollaborators = pgTable(
  'board_collaborators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    board_id: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: varchar('permission', { length: 20 }).default('edit').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_board_collaborators_board_user').on(table.board_id, table.user_id),
  ],
);
