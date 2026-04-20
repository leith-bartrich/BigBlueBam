// §1 Wave 5 banter subs - Drizzle schema for banter_agent_subscriptions.
//
// Physical table lives in infra/postgres/migrations/0134_banter_agent_subscriptions.sql.
// Keep columns in lockstep with that migration; the drift guard
// (pnpm db:check) compares this declaration against the live DB.
import {
  pgTable,
  uuid,
  jsonb,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations, users } from './bbb-refs.js';
import { banterChannels } from './channels.js';

export const banterAgentSubscriptions = pgTable(
  'banter_agent_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    subscriber_user_id: uuid('subscriber_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel_id: uuid('channel_id')
      .notNull()
      .references(() => banterChannels.id, { onDelete: 'cascade' }),
    pattern_spec: jsonb('pattern_spec').notNull(),
    opted_in_by: uuid('opted_in_by')
      .notNull()
      .references(() => users.id),
    opted_in_at: timestamp('opted_in_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    disabled_at: timestamp('disabled_at', { withTimezone: true }),
    last_matched_at: timestamp('last_matched_at', { withTimezone: true }),
    match_count: integer('match_count').notNull().default(0),
    rate_limit_per_hour: integer('rate_limit_per_hour').notNull().default(30),
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // The partial-unique predicate (WHERE disabled_at IS NULL) and the
    // md5() expression live in the migration; Drizzle's index builder
    // cannot express either, so we declare the column set only.
    uniqueIndex('uq_banter_agent_sub_actor_chan_spec').on(
      table.subscriber_user_id,
      table.channel_id,
      sql`md5(${table.pattern_spec}::text)`,
    ),
    index('idx_banter_agent_sub_channel_active').on(table.channel_id),
    index('idx_banter_agent_sub_subscriber_active').on(
      table.subscriber_user_id,
    ),
  ],
);
