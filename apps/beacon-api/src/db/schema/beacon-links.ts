import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { beaconEntries } from './beacon-entries.js';

export const beaconLinkTypeEnum = pgEnum('beacon_link_type', [
  'RelatedTo',
  'Supersedes',
  'DependsOn',
  'ConflictsWith',
  'SeeAlso',
]);

export const beaconLinks = pgTable(
  'beacon_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source_id: uuid('source_id')
      .notNull()
      .references(() => beaconEntries.id, { onDelete: 'cascade' }),
    target_id: uuid('target_id')
      .notNull()
      .references(() => beaconEntries.id, { onDelete: 'cascade' }),
    link_type: beaconLinkTypeEnum('link_type').notNull(),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('beacon_links_source_target_type_key').on(
      table.source_id,
      table.target_id,
      table.link_type,
    ),
    index('idx_beacon_links_source_id').on(table.source_id),
    index('idx_beacon_links_target_id').on(table.target_id),
  ],
);
