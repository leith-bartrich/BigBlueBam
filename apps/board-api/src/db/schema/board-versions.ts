import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  unique,
  customType,
} from 'drizzle-orm/pg-core';
import { boards } from './boards.js';
import { users } from './bbb-refs.js';

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const boardVersions = pgTable(
  'board_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    board_id: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    version_number: integer('version_number').notNull(),
    name: varchar('name', { length: 255 }),
    yjs_state: bytea('yjs_state'),
    thumbnail_url: varchar('thumbnail_url', { length: 2048 }),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_board_versions_board_version').on(table.board_id, table.version_number),
  ],
);
