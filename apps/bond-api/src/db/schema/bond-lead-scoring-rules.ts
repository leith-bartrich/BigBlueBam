import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './bbb-refs.js';

export const bondLeadScoringRules = pgTable(
  'bond_lead_scoring_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    condition_field: varchar('condition_field', { length: 100 }).notNull(),
    condition_operator: varchar('condition_operator', { length: 20 }).notNull(),
    condition_value: text('condition_value').notNull(),
    score_delta: integer('score_delta').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bond_scoring_org').on(table.organization_id).where(sql`enabled = true`),
  ],
);
