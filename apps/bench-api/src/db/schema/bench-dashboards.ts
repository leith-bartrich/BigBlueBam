import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users, projects } from './bbb-refs.js';

export const benchDashboards = pgTable(
  'bench_dashboards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    project_id: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    layout: jsonb('layout').notNull().default([]),
    visibility: varchar('visibility', { length: 20 }).notNull().default('private'),
    is_default: boolean('is_default').notNull().default(false),
    auto_refresh_seconds: integer('auto_refresh_seconds'),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updated_by: uuid('updated_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bench_dash_org').on(table.organization_id),
    index('idx_bench_dash_project').on(table.project_id),
    index('idx_bench_dash_visibility').on(table.organization_id, table.visibility),
  ],
);
