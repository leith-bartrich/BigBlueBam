import {
  pgTable,
  uuid,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { boards } from './boards.js';
import { users, tasks } from './bbb-refs.js';

export const boardTaskLinks = pgTable(
  'board_task_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    board_id: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    element_id: uuid('element_id'),
    task_id: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_board_task_links_element_task').on(table.element_id, table.task_id),
    index('idx_board_task_links_board_id').on(table.board_id),
    index('idx_board_task_links_task_id').on(table.task_id),
  ],
);
