import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { tasks } from './tasks.js';
import { users, actorTypeEnum } from './users.js';

export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    task_id: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'set null' }),
    actor_id: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actor_type: actorTypeEnum('actor_type').default('human').notNull(),
    impersonator_id: uuid('impersonator_id')
      .references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    details: jsonb('details'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_activity_project_time').on(table.project_id, table.created_at),
    index('idx_activity_task_time').on(table.task_id, table.created_at),
    index('idx_activity_actor_type_time').on(table.actor_type, table.created_at),
  ],
);
