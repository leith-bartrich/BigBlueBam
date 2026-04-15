import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const benchMaterializedViews = pgTable(
  'bench_materialized_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    view_name: varchar('view_name', { length: 100 }).notNull().unique(),
    description: text('description'),
    refresh_cron: varchar('refresh_cron', { length: 100 }).notNull().default('*/5 * * * *'),
    last_refreshed_at: timestamp('last_refreshed_at', { withTimezone: true }),
    refresh_duration_ms: integer('refresh_duration_ms'),
    // Added in migration 0085 so the refresh scheduler worker can record
    // attempt outcomes and compute the next scheduled run time without
    // overwriting the most recent successful last_refreshed_at.
    last_refresh_attempt_at: timestamp('last_refresh_attempt_at', { withTimezone: true }),
    last_refresh_status: varchar('last_refresh_status', { length: 20 }),
    last_refresh_error: text('last_refresh_error'),
    next_scheduled_at: timestamp('next_scheduled_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Migration 0085 partial index on next_scheduled_at, used by the refresh
    // scheduler tick to cheaply find views that are due for refresh.
    index('idx_bench_mv_scheduled').on(table.next_scheduled_at),
  ],
);
