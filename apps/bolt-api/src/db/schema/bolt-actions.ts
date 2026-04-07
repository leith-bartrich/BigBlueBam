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

export const boltOnErrorEnum = pgEnum('bolt_on_error', ['stop', 'continue', 'retry']);

export const boltActions = pgTable(
  'bolt_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    automation_id: uuid('automation_id')
      .notNull()
      .references(() => boltAutomations.id, { onDelete: 'cascade' }),
    sort_order: integer('sort_order').notNull(),
    mcp_tool: varchar('mcp_tool', { length: 100 }).notNull(),
    parameters: jsonb('parameters'),
    on_error: boltOnErrorEnum('on_error').default('stop').notNull(),
    retry_count: integer('retry_count').default(0).notNull(),
    retry_delay_ms: integer('retry_delay_ms').default(1000).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_bolt_actions_automation_id').on(table.automation_id)],
);
