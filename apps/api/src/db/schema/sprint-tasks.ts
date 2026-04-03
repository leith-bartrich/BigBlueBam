import { pgTable, uuid, varchar, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sprints } from './sprints.js';
import { tasks } from './tasks.js';

export const sprintTasks = pgTable(
  'sprint_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sprint_id: uuid('sprint_id')
      .notNull()
      .references(() => sprints.id, { onDelete: 'cascade' }),
    task_id: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    added_at: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
    removed_at: timestamp('removed_at', { withTimezone: true }),
    removal_reason: varchar('removal_reason', { length: 100 }),
    story_points_at_add: integer('story_points_at_add'),
  },
  (table) => [
    uniqueIndex('sprint_tasks_unique_idx').on(table.sprint_id, table.task_id),
    index('sprint_tasks_task_id_idx').on(table.task_id),
  ],
);
