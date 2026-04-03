import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { users } from './users.js';

export const savedViews = pgTable(
  'saved_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    filters: jsonb('filters').default({}).notNull(),
    sort: varchar('sort', { length: 100 }),
    view_type: varchar('view_type', { length: 20 }).default('board').notNull(),
    swimlane: varchar('swimlane', { length: 50 }),
    is_shared: boolean('is_shared').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('saved_views_project_id_idx').on(table.project_id),
    index('saved_views_user_id_idx').on(table.user_id),
  ],
);
