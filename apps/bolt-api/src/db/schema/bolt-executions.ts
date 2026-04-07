import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { boltAutomations } from './bolt-automations.js';

export const boltExecutionStatusEnum = pgEnum('bolt_execution_status', [
  'running',
  'success',
  'partial',
  'failed',
  'skipped',
]);

export const boltExecutions = pgTable(
  'bolt_executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    automation_id: uuid('automation_id')
      .notNull()
      .references(() => boltAutomations.id, { onDelete: 'cascade' }),
    status: boltExecutionStatusEnum('status').default('running').notNull(),
    trigger_event: jsonb('trigger_event'),
    started_at: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    duration_ms: integer('duration_ms'),
    conditions_met: boolean('conditions_met').default(true).notNull(),
    condition_log: jsonb('condition_log'),
    error_message: text('error_message'),
    error_step: integer('error_step'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bolt_executions_automation_id').on(table.automation_id),
    index('idx_bolt_executions_status').on(table.status),
    index('idx_bolt_executions_started_at').on(table.started_at),
  ],
);
