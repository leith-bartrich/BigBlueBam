import { pgTable, uuid, varchar, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const taskStates = pgTable(
  'task_states',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    color: varchar('color', { length: 7 }),
    icon: varchar('icon', { length: 50 }),
    category: varchar('category', { length: 50 }).notNull(),
    position: integer('position').notNull(),
    is_default: boolean('is_default').default(false).notNull(),
    is_closed: boolean('is_closed').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('task_states_project_id_idx').on(table.project_id),
  ],
);
