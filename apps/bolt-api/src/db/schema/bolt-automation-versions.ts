import {
  pgTable,
  uuid,
  integer,
  jsonb,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { boltAutomations } from './bolt-automations.js';
import { users } from './bbb-refs.js';

export const boltAutomationVersions = pgTable(
  'bolt_automation_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    automation_id: uuid('automation_id')
      .notNull()
      .references(() => boltAutomations.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
    snapshot: jsonb('snapshot').notNull(),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    note: text('note'),
  },
  (table) => [
    index('idx_bolt_automation_versions_automation').on(table.automation_id, table.version),
    uniqueIndex('idx_bolt_automation_versions_uniq').on(table.automation_id, table.version),
  ],
);
