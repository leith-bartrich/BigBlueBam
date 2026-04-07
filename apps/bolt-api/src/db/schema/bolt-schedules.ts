import {
  pgTable,
  uuid,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { boltAutomations } from './bolt-automations.js';

export const boltSchedules = pgTable(
  'bolt_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    automation_id: uuid('automation_id')
      .notNull()
      .unique()
      .references(() => boltAutomations.id, { onDelete: 'cascade' }),
    next_run_at: timestamp('next_run_at', { withTimezone: true }),
    last_run_at: timestamp('last_run_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_bolt_schedules_next_run_at').on(table.next_run_at)],
);
