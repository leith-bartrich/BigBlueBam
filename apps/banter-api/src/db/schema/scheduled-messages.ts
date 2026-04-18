// §13 Wave 4 scheduled banter — drizzle schema for banter_scheduled_messages.
//
// Backs the durable queue for scheduled and quiet-hours-deferred posts.
// Row is created when a caller asks for a future post (or an immediate post
// that lands in a quiet window with defer_if_quiet=true). A BullMQ delayed
// job fires at scheduled_at, the worker re-verifies membership, then inserts
// the real banter_messages row and flips status to 'delivered'.
//
// Durability model: row is the source of truth. Worker has a startup
// reconciler that re-enqueues pending rows whose BullMQ job is missing
// (e.g. Redis was flushed).
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations, users } from './bbb-refs.js';
import { banterChannels } from './channels.js';

export const banterScheduledMessages = pgTable(
  'banter_scheduled_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    channel_id: uuid('channel_id')
      .notNull()
      .references(() => banterChannels.id, { onDelete: 'cascade' }),
    author_id: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    content_format: varchar('content_format', { length: 20 }).notNull().default('html'),
    thread_parent_id: uuid('thread_parent_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    scheduled_at: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    delivered_message_id: uuid('delivered_message_id'),
    // Why the post was deferred. 'quiet_hours' when a defer_if_quiet caller
    // hit a DND window, 'scheduled' for a normal scheduled_at request,
    // 'membership_revoked' when the worker marks a pending row failed.
    defer_reason: varchar('defer_reason', { length: 40 }),
    bullmq_job_id: varchar('bullmq_job_id', { length: 64 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    delivered_at: timestamp('delivered_at', { withTimezone: true }),
    cancelled_at: timestamp('cancelled_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_banter_scheduled_channel_status').on(
      table.channel_id,
      table.status,
      table.scheduled_at,
    ),
    index('idx_banter_scheduled_pending_time').on(table.scheduled_at),
  ],
);
