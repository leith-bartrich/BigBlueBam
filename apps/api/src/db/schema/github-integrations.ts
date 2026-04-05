import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { phases } from './phases.js';
import { users } from './users.js';
import { tasks } from './tasks.js';

export const githubIntegrations = pgTable(
  'github_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: 'cascade' }),
    repo_owner: varchar('repo_owner', { length: 100 }).notNull(),
    repo_name: varchar('repo_name', { length: 200 }).notNull(),
    webhook_secret: text('webhook_secret').notNull(),
    transition_on_pr_open_phase_id: uuid('transition_on_pr_open_phase_id').references(
      () => phases.id,
      { onDelete: 'set null' },
    ),
    transition_on_pr_merged_phase_id: uuid('transition_on_pr_merged_phase_id').references(
      () => phases.id,
      { onDelete: 'set null' },
    ),
    enabled: boolean('enabled').default(true).notNull(),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('github_integrations_repo_unique').on(table.repo_owner, table.repo_name),
    index('idx_github_integrations_repo').on(table.repo_owner, table.repo_name),
  ],
);

export const taskGithubRefs = pgTable(
  'task_github_refs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    task_id: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    ref_type: varchar('ref_type', { length: 20 }).notNull(),
    ref_id: varchar('ref_id', { length: 100 }).notNull(),
    ref_url: text('ref_url').notNull(),
    ref_title: text('ref_title'),
    author_name: varchar('author_name', { length: 200 }),
    status: varchar('status', { length: 50 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('task_github_refs_unique').on(table.task_id, table.ref_type, table.ref_id),
    index('idx_task_github_refs_task').on(table.task_id, table.created_at),
  ],
);
