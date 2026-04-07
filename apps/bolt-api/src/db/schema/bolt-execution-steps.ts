import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  jsonb,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { boltExecutions } from './bolt-executions.js';
import { boltActions } from './bolt-actions.js';

export const boltStepStatusEnum = pgEnum('bolt_step_status', ['success', 'failed', 'skipped']);

export const boltExecutionSteps = pgTable(
  'bolt_execution_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    execution_id: uuid('execution_id')
      .notNull()
      .references(() => boltExecutions.id, { onDelete: 'cascade' }),
    action_id: uuid('action_id')
      .notNull()
      .references(() => boltActions.id, { onDelete: 'cascade' }),
    step_index: integer('step_index').notNull(),
    mcp_tool: varchar('mcp_tool', { length: 100 }).notNull(),
    parameters_resolved: jsonb('parameters_resolved'),
    status: boltStepStatusEnum('status').default('skipped').notNull(),
    response: jsonb('response'),
    error_message: text('error_message'),
    duration_ms: integer('duration_ms'),
    executed_at: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_bolt_execution_steps_execution_id').on(table.execution_id)],
);
