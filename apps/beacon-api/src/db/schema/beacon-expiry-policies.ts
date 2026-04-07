import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  timestamp,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, organizations, projects } from './bbb-refs.js';

export const expiryScopeEnum = pgEnum('expiry_scope', [
  'System',
  'Organization',
  'Project',
]);

export const beaconExpiryPolicies = pgTable(
  'beacon_expiry_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: expiryScopeEnum('scope').notNull(),
    organization_id: uuid('organization_id').references(() => organizations.id),
    project_id: uuid('project_id').references(() => projects.id),
    min_expiry_days: integer('min_expiry_days').notNull(),
    max_expiry_days: integer('max_expiry_days').notNull(),
    default_expiry_days: integer('default_expiry_days').notNull(),
    grace_period_days: integer('grace_period_days').default(14).notNull(),
    set_by: uuid('set_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('beacon_expiry_policies_scope_org_project_key').on(
      table.scope,
      table.organization_id,
      table.project_id,
    ),
    check('min_lte_default', sql`min_expiry_days <= default_expiry_days`),
    check('default_lte_max', sql`default_expiry_days <= max_expiry_days`),
    check('min_positive', sql`min_expiry_days > 0`),
  ],
);
