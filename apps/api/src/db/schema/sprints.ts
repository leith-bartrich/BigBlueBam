import { pgTable, uuid, varchar, text, integer, date, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const sprints = pgTable(
  'sprints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    goal: text('goal'),
    start_date: date('start_date'),
    end_date: date('end_date'),
    status: varchar('status', { length: 50 }).default('planned').notNull(),
    velocity: integer('velocity'),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    closed_at: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    index('sprints_project_id_idx').on(table.project_id),
    index('sprints_project_status_idx').on(table.project_id, table.status),
  ],
);
