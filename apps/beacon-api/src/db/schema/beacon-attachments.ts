import {
  pgTable,
  uuid,
  varchar,
  bigint,
  integer,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { beaconEntries } from './beacon-entries.js';

/**
 * beacon_attachments (migration 0080)
 *
 * Rich media attached to a beacon. The actual bytes live in MinIO under
 * storage_key; this row is the metadata + FK. UNIQUE(beacon_id, filename)
 * prevents duplicate filename uploads on the same beacon.
 */
export const beaconAttachments = pgTable(
  'beacon_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    beacon_id: uuid('beacon_id')
      .notNull()
      .references(() => beaconEntries.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 512 }).notNull(),
    content_type: varchar('content_type', { length: 128 }).notNull(),
    size_bytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storage_key: varchar('storage_key', { length: 1024 }).notNull(),
    sort_order: integer('sort_order').default(0).notNull(),
    uploaded_by: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('beacon_attachments_beacon_id_filename_key').on(table.beacon_id, table.filename),
    index('idx_beacon_attachments_beacon_id').on(table.beacon_id),
  ],
);

export type BeaconAttachment = typeof beaconAttachments.$inferSelect;
export type NewBeaconAttachment = typeof beaconAttachments.$inferInsert;
