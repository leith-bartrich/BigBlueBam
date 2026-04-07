import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { beaconEntries } from './beacon-entries.js';

export const beaconTags = pgTable(
  'beacon_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    beacon_id: uuid('beacon_id')
      .notNull()
      .references(() => beaconEntries.id, { onDelete: 'cascade' }),
    tag: varchar('tag', { length: 128 }).notNull(),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('beacon_tags_beacon_id_tag_key').on(table.beacon_id, table.tag),
    index('idx_beacon_tags_beacon_id').on(table.beacon_id),
    index('idx_beacon_tags_tag').on(table.tag),
  ],
);
