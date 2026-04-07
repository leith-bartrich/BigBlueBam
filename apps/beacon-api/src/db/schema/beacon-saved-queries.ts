import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, organizations, projects } from './bbb-refs.js';

export const savedQueryScopeEnum = pgEnum('saved_query_scope', [
  'Private',
  'Project',
  'Organization',
]);

export const beaconSavedQueries = pgTable(
  'beacon_saved_queries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    description: varchar('description', { length: 500 }),
    query_body: jsonb('query_body').notNull(),
    owner_id: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    scope: savedQueryScopeEnum('scope').default('Private').notNull(),
    project_id: uuid('project_id').references(() => projects.id),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('beacon_saved_queries_owner_name_key').on(table.owner_id, table.name),
    index('idx_saved_queries_owner').on(table.owner_id),
  ],
);
