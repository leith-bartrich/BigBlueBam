import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';

export const benchMaterializedViews = pgTable('bench_materialized_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  view_name: varchar('view_name', { length: 100 }).notNull().unique(),
  description: text('description'),
  refresh_cron: varchar('refresh_cron', { length: 100 }).notNull().default('*/5 * * * *'),
  last_refreshed_at: timestamp('last_refreshed_at', { withTimezone: true }),
  refresh_duration_ms: integer('refresh_duration_ms'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
