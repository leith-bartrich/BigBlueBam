import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { boltAutomations } from './bolt-automations.js';
import { users } from './bbb-refs.js';

export const boltAutomationDataMigrations = pgTable(
  'bolt_automation_data_migrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    automation_id: uuid('automation_id')
      .notNull()
      .references(() => boltAutomations.id, { onDelete: 'cascade' }),
    from_version: integer('from_version').notNull(),
    to_version: integer('to_version').notNull(),
    migrated_at: timestamp('migrated_at', { withTimezone: true }).defaultNow().notNull(),
    migrated_by: uuid('migrated_by').references(() => users.id),
    notes: text('notes'),
  },
  (table) => [
    index('idx_bolt_automation_data_migrations_automation').on(
      table.automation_id,
      table.migrated_at,
    ),
  ],
);
