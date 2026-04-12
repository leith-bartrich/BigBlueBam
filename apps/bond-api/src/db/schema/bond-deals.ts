import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  bigint,
  integer,
  date,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations, users } from './bbb-refs.js';
import { bondPipelines } from './bond-pipelines.js';
import { bondPipelineStages } from './bond-pipeline-stages.js';
import { bondCompanies } from './bond-companies.js';

export const bondDeals = pgTable(
  'bond_deals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    pipeline_id: uuid('pipeline_id')
      .notNull()
      .references(() => bondPipelines.id, { onDelete: 'restrict' }),
    stage_id: uuid('stage_id')
      .notNull()
      .references(() => bondPipelineStages.id, { onDelete: 'restrict' }),

    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    value: bigint('value', { mode: 'number' }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    expected_close_date: date('expected_close_date'),
    probability_pct: integer('probability_pct'),
    // weighted_value is a GENERATED ALWAYS AS ... STORED column in PostgreSQL — read-only
    weighted_value: bigint('weighted_value', { mode: 'number' }),

    // Outcome
    closed_at: timestamp('closed_at', { withTimezone: true }),
    close_reason: text('close_reason'),
    lost_to_competitor: varchar('lost_to_competitor', { length: 255 }),

    // Ownership
    owner_id: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    // Company association
    company_id: uuid('company_id').references(() => bondCompanies.id, { onDelete: 'set null' }),

    // Custom fields
    custom_fields: jsonb('custom_fields').default({}).notNull(),

    // Stage tracking
    stage_entered_at: timestamp('stage_entered_at', { withTimezone: true }).defaultNow().notNull(),
    last_activity_at: timestamp('last_activity_at', { withTimezone: true }),
    rotting_alerted_at: timestamp('rotting_alerted_at', { withTimezone: true }),

    // Metadata
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bond_deals_org').on(table.organization_id),
    index('idx_bond_deals_pipeline').on(table.pipeline_id, table.stage_id),
    index('idx_bond_deals_owner').on(table.owner_id),
    index('idx_bond_deals_company').on(table.company_id),
    index('idx_bond_deals_close').on(table.expected_close_date).where(sql`closed_at IS NULL`),
    index('idx_bond_deals_stale').on(table.stage_entered_at).where(sql`closed_at IS NULL`),
  ],
);
