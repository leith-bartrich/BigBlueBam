import { pgTable, uuid, varchar, text, boolean, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { projects } from './projects.js';
import { tasks } from './tasks.js';
import { organizations } from './organizations.js';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    org_id: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    project_id: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    task_id: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    body: text('body'),
    // Migration 0019: polymorphic-across-apps fields
    source_app: text('source_app').notNull().default('bbb'),
    deep_link: text('deep_link'),
    category: text('category'),
    metadata: jsonb('metadata').notNull().default({}),
    is_read: boolean('is_read').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_notifications_user_unread').on(table.user_id, table.is_read, table.created_at),
    index('idx_notifications_user_source_unread').on(
      table.user_id,
      table.source_app,
      table.is_read,
      table.created_at,
    ),
    index('idx_notifications_user_category').on(table.user_id, table.category, table.created_at),
  ],
);
