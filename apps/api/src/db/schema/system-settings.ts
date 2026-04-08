import { pgTable, varchar, jsonb, uuid, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Generic key-value store for SuperUser-configured platform options.
 * Each row is a single setting identified by a unique key string.
 */
export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updated_by: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
