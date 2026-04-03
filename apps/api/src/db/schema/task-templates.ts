import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects.js';
import { phases } from './phases.js';
import { users } from './users.js';

export const taskTemplates = pgTable(
  'task_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    title_pattern: varchar('title_pattern', { length: 500 }),
    description: text('description'),
    priority: varchar('priority', { length: 20 }).default('medium'),
    phase_id: uuid('phase_id').references(() => phases.id),
    label_ids: uuid('label_ids')
      .array()
      .default(sql`'{}'::uuid[]`),
    subtask_titles: text('subtask_titles')
      .array()
      .default(sql`'{}'::text[]`),
    story_points: integer('story_points'),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('task_templates_project_id_idx').on(table.project_id),
  ],
);
