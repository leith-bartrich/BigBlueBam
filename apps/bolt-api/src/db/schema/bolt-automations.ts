import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, projects, users } from './bbb-refs.js';

export const boltTriggerSourceEnum = pgEnum('bolt_trigger_source', [
  'bam',
  'banter',
  'beacon',
  'brief',
  'helpdesk',
  'schedule',
]);

export const boltAutomations = pgTable(
  'bolt_automations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    project_id: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    enabled: boolean('enabled').default(true).notNull(),

    trigger_source: boltTriggerSourceEnum('trigger_source').notNull(),
    trigger_event: varchar('trigger_event', { length: 60 }).notNull(),
    trigger_filter: jsonb('trigger_filter'),
    cron_expression: varchar('cron_expression', { length: 100 }),
    cron_timezone: varchar('cron_timezone', { length: 50 }).default('UTC').notNull(),

    max_executions_per_hour: integer('max_executions_per_hour').default(100).notNull(),
    cooldown_seconds: integer('cooldown_seconds').default(0).notNull(),
    last_executed_at: timestamp('last_executed_at', { withTimezone: true }),

    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updated_by: uuid('updated_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bolt_automations_org_id').on(table.org_id),
    index('idx_bolt_automations_project_id').on(table.project_id),
    index('idx_bolt_automations_trigger').on(table.trigger_source, table.trigger_event),
    index('idx_bolt_automations_enabled').on(table.enabled),
  ],
);
