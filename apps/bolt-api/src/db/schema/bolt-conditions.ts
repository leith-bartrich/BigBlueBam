import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { boltAutomations } from './bolt-automations.js';

export const boltConditionOperatorEnum = pgEnum('bolt_condition_operator', [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty',
  'in',
  'not_in',
  'matches_regex',
]);

export const boltConditionLogicEnum = pgEnum('bolt_condition_logic', ['and', 'or']);

export const boltConditions = pgTable(
  'bolt_conditions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    automation_id: uuid('automation_id')
      .notNull()
      .references(() => boltAutomations.id, { onDelete: 'cascade' }),
    sort_order: integer('sort_order').notNull(),
    field: varchar('field', { length: 255 }).notNull(),
    operator: boltConditionOperatorEnum('operator').notNull(),
    value: jsonb('value'),
    logic_group: boltConditionLogicEnum('logic_group').default('and').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_bolt_conditions_automation_id').on(table.automation_id)],
);
