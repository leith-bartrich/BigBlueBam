import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { beaconEntries } from './beacon-entries.js';

/**
 * beacon_comments (migration 0079)
 *
 * Threaded discussion attached to a beacon entry. Top-level comments have
 * parent_id NULL, replies point at their parent. ON DELETE CASCADE on both
 * beacon_id and parent_id so removing a beacon or a parent comment wipes
 * the descendants in one shot.
 */
export const beaconComments = pgTable(
  'beacon_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    beacon_id: uuid('beacon_id')
      .notNull()
      .references(() => beaconEntries.id, { onDelete: 'cascade' }),
    parent_id: uuid('parent_id').references((): AnyPgColumn => beaconComments.id, {
      onDelete: 'cascade',
    }),
    author_id: uuid('author_id')
      .notNull()
      .references(() => users.id),
    body_markdown: text('body_markdown').notNull(),
    body_html: text('body_html'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_beacon_comments_beacon_id').on(table.beacon_id, table.created_at),
    index('idx_beacon_comments_parent_id').on(table.parent_id),
  ],
);

export type BeaconComment = typeof beaconComments.$inferSelect;
export type NewBeaconComment = typeof beaconComments.$inferInsert;
