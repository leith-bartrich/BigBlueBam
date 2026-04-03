import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { banterChannels } from './channels.js';

export const banterMessages = pgTable(
  'banter_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel_id: uuid('channel_id')
      .notNull()
      .references(() => banterChannels.id, { onDelete: 'cascade' }),
    author_id: uuid('author_id')
      .notNull()
      .references(() => users.id),
    thread_parent_id: uuid('thread_parent_id'),
    content: text('content').notNull(),
    content_plain: text('content_plain').notNull().default(''),
    content_format: varchar('content_format', { length: 20 }).notNull().default('html'),
    is_system: boolean('is_system').notNull().default(false),
    is_bot: boolean('is_bot').notNull().default(false),
    is_edited: boolean('is_edited').notNull().default(false),
    is_deleted: boolean('is_deleted').notNull().default(false),
    edited_at: timestamp('edited_at', { withTimezone: true }),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    deleted_by: uuid('deleted_by'),
    call_id: uuid('call_id'),
    reply_count: integer('reply_count').notNull().default(0),
    reply_user_ids: uuid('reply_user_ids').array().notNull().default([]),
    last_reply_at: timestamp('last_reply_at', { withTimezone: true }),
    reaction_counts: jsonb('reaction_counts').notNull().default({}),
    attachment_count: integer('attachment_count').notNull().default(0),
    has_link_preview: boolean('has_link_preview').notNull().default(false),
    metadata: jsonb('metadata').notNull().default({}),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('banter_messages_channel_created_idx').on(table.channel_id, table.created_at),
    index('banter_messages_channel_thread_idx').on(
      table.channel_id,
      table.thread_parent_id,
      table.created_at,
    ),
    index('banter_messages_author_idx').on(table.author_id, table.created_at),
    index('banter_messages_channel_id_idx').on(table.channel_id, table.id),
  ],
);
