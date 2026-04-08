import { pgTable, uuid, varchar, jsonb, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { bearingKeyResults } from './bearing-key-results.js';

export const bearingKrLinks = pgTable('bearing_kr_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  key_result_id: uuid('key_result_id').notNull().references(() => bearingKeyResults.id, { onDelete: 'cascade' }),
  link_type: varchar('link_type', { length: 30 }).notNull(),
  target_type: varchar('target_type', { length: 30 }).notNull(),
  target_id: uuid('target_id').notNull(),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_bearing_kr_links_kr').on(table.key_result_id),
  index('idx_bearing_kr_links_target').on(table.target_type, table.target_id),
  unique('bearing_kr_links_kr_target').on(table.key_result_id, table.target_type, table.target_id),
]);
