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
    // §17 Wave 4 attachments: scanner metadata added by migration 0131.
    // scan_status is one of 'pending' | 'clean' | 'infected' | 'error'.
    // Deep-link presigning is gated to 'clean' only by the federated
    // attachment dispatcher; see services/attachment-meta.service.ts.
    scan_status: varchar('scan_status', { length: 50 }).default('pending').notNull(),
    scan_signature: text('scan_signature'),
    scanned_at: timestamp('scanned_at', { withTimezone: true }),
    scan_error: text('scan_error'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('attachments_task_id_idx').on(table.task_id),
    index('idx_attachments_scan_status').on(table.scan_status),
  ],
);
