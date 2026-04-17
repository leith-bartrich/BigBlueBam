import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { tickets } from './tickets.js';
import { helpdeskUsers } from './helpdesk-users.js';

/**
 * G6: file-attachment metadata backed by MinIO.
 *
 * Migration 0114 creates this table. `storage_key` holds the MinIO object
 * path (conventionally `helpdesk-attachments/<ticket_id>/<uuid>/<filename>`)
 * and `scan_status` defaults to `pending`; a future ClamAV job would flip it
 * to `clean` or `infected`. We emit a signed URL at read time rather than
 * persist one since presigned URLs carry an expiry.
 */
export const helpdeskTicketAttachments = pgTable(
  'helpdesk_ticket_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_id: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    uploaded_by: uuid('uploaded_by')
      .notNull()
      .references(() => helpdeskUsers.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 512 }).notNull(),
    content_type: varchar('content_type', { length: 128 }).notNull(),
    size_bytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storage_key: varchar('storage_key', { length: 1024 }).notNull(),
    scan_status: varchar('scan_status', { length: 50 }).default('pending').notNull(),
    scan_error: text('scan_error'),
    scanned_at: timestamp('scanned_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_helpdesk_ticket_attachments_ticket_id').on(table.ticket_id),
    index('idx_helpdesk_ticket_attachments_scan_status').on(table.scan_status),
  ],
);
