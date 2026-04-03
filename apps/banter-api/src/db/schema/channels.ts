import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';
import { banterChannelGroups } from './channel-groups.js';

export const banterChannels = pgTable(
  'banter_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    display_name: varchar('display_name', { length: 100 }),
    slug: varchar('slug', { length: 80 }).notNull(),
    type: varchar('type', { length: 20 }).notNull().default('public'),
    topic: varchar('topic', { length: 500 }),
    description: text('description'),
    icon: varchar('icon', { length: 10 }),
    channel_group_id: uuid('channel_group_id').references(() => banterChannelGroups.id, {
      onDelete: 'set null',
    }),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    is_archived: boolean('is_archived').notNull().default(false),
    is_default: boolean('is_default').notNull().default(false),
    allow_bots: boolean('allow_bots').notNull().default(true),
    allow_huddles: boolean('allow_huddles').notNull().default(true),
    message_retention_days: integer('message_retention_days'),
    last_message_at: timestamp('last_message_at', { withTimezone: true }),
    last_message_preview: varchar('last_message_preview', { length: 200 }),
    message_count: integer('message_count').notNull().default(0),
    member_count: integer('member_count').notNull().default(0),
    active_huddle_id: uuid('active_huddle_id'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('banter_channels_org_slug_idx').on(table.org_id, table.slug),
    index('banter_channels_org_type_idx').on(table.org_id, table.type, table.is_archived),
    index('banter_channels_org_last_msg_idx').on(table.org_id, table.last_message_at),
  ],
);
