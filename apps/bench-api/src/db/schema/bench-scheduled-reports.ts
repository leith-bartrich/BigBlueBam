import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';
import { benchDashboards } from './bench-dashboards.js';

export const benchScheduledReports = pgTable(
  'bench_scheduled_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dashboard_id: uuid('dashboard_id')
      .notNull()
      .references(() => benchDashboards.id, { onDelete: 'cascade' }),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    cron_expression: varchar('cron_expression', { length: 100 }).notNull(),
    cron_timezone: varchar('cron_timezone', { length: 50 }).default('UTC'),
    delivery_method: varchar('delivery_method', { length: 20 }).notNull(),
    delivery_target: text('delivery_target').notNull(),
    export_format: varchar('export_format', { length: 10 }).notNull().default('pdf'),
    enabled: boolean('enabled').notNull().default(true),
    last_sent_at: timestamp('last_sent_at', { withTimezone: true }),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bench_reports_org').on(table.organization_id),
  ],
);
