import { pgTable, uuid, varchar, text, bigint, timestamp, index } from 'drizzle-orm/pg-core';
import { tasks } from './tasks.js';
import { users } from './users.js';

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    task_id: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    uploader_id: uuid('uploader_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 500 }).notNull(),
    content_type: varchar('content_type', { length: 255 }),
    size_bytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storage_key: text('storage_key').notNull(),
    thumbnail_key: text('thumbnail_key'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('attachments_task_id_idx').on(table.task_id),
  ],
);
