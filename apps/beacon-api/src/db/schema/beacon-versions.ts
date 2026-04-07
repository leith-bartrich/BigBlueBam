import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { beaconEntries } from './beacon-entries.js';
import { beaconAgents } from './beacon-agents.js';

export const beaconVersions = pgTable(
  'beacon_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    beacon_id: uuid('beacon_id')
      .notNull()
      .references(() => beaconEntries.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    summary: text('summary'),
    body_markdown: text('body_markdown').notNull(),
    changed_by: uuid('changed_by').references(() => users.id),
    changed_by_agent: uuid('changed_by_agent').references(() => beaconAgents.id),
    change_note: text('change_note'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('beacon_versions_beacon_id_version_key').on(table.beacon_id, table.version),
    index('idx_beacon_versions_beacon_id').on(table.beacon_id),
  ],
);
