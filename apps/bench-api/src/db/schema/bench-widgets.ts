import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { benchDashboards } from './bench-dashboards.js';

export const benchWidgets = pgTable(
  'bench_widgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dashboard_id: uuid('dashboard_id')
      .notNull()
      .references(() => benchDashboards.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    widget_type: varchar('widget_type', { length: 30 }).notNull(),
    data_source: varchar('data_source', { length: 30 }).notNull(),
    entity: varchar('entity', { length: 60 }).notNull(),
    query_config: jsonb('query_config').notNull(),
    viz_config: jsonb('viz_config').default({}),
    kpi_config: jsonb('kpi_config'),
    cache_ttl_seconds: integer('cache_ttl_seconds'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_bench_widgets_dashboard').on(table.dashboard_id)],
);
