import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { users } from './users.js';

export const slackIntegrations = pgTable(
  'slack_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: 'cascade' }),
    webhook_url: text('webhook_url').notNull(),
    notify_on_task_created: boolean('notify_on_task_created').default(true).notNull(),
    notify_on_task_completed: boolean('notify_on_task_completed').default(true).notNull(),
    notify_on_sprint_started: boolean('notify_on_sprint_started').default(true).notNull(),
    notify_on_sprint_completed: boolean('notify_on_sprint_completed').default(true).notNull(),
    slash_command_token: text('slash_command_token'),
    enabled: boolean('enabled').default(true).notNull(),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('slack_integrations_project_id_idx').on(table.project_id),
  ],
);
