import { pgTable, uuid, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { bearingKeyResults } from './bearing-key-results.js';

export const bearingKrSnapshots = pgTable('bearing_kr_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  key_result_id: uuid('key_result_id').notNull().references(() => bearingKeyResults.id, { onDelete: 'cascade' }),
  value: numeric('value', { precision: 12, scale: 2 }).notNull(),
  progress: numeric('progress', { precision: 5, scale: 2 }).notNull(),
  recorded_at: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_bearing_kr_snapshots_kr').on(table.key_result_id),
  index('idx_bearing_kr_snapshots_date').on(table.recorded_at),
]);
