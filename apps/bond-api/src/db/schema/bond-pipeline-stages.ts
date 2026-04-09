import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { bondPipelines } from './bond-pipelines.js';

export const bondPipelineStages = pgTable(
  'bond_pipeline_stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipeline_id: uuid('pipeline_id')
      .notNull()
      .references(() => bondPipelines.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    sort_order: integer('sort_order').notNull().default(0),
    stage_type: varchar('stage_type', { length: 20 }).notNull().default('active'),
    probability_pct: integer('probability_pct').default(0),
    rotting_days: integer('rotting_days'),
    color: varchar('color', { length: 7 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bond_stages_pipeline').on(table.pipeline_id, table.sort_order),
  ],
);
