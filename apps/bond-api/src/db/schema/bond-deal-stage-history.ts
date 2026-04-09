import {
  pgTable,
  uuid,
  timestamp,
  interval,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { bondDeals } from './bond-deals.js';
import { bondPipelineStages } from './bond-pipeline-stages.js';

export const bondDealStageHistory = pgTable(
  'bond_deal_stage_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deal_id: uuid('deal_id')
      .notNull()
      .references(() => bondDeals.id, { onDelete: 'cascade' }),
    from_stage_id: uuid('from_stage_id').references(() => bondPipelineStages.id),
    to_stage_id: uuid('to_stage_id')
      .notNull()
      .references(() => bondPipelineStages.id),
    changed_by: uuid('changed_by').references(() => users.id),
    changed_at: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
    duration_in_stage: interval('duration_in_stage'),
  },
  (table) => [
    index('idx_bond_stage_history_deal').on(table.deal_id, table.changed_at),
  ],
);
