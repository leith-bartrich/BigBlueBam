import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users, projects } from './bbb-refs.js';

export const bookCalendars = pgTable(
  'book_calendars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    owner_user_id: uuid('owner_user_id').references(() => users.id, { onDelete: 'cascade' }),
    project_id: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 7 }).notNull().default('#3b82f6'),
    calendar_type: varchar('calendar_type', { length: 20 }).notNull().default('personal'),
    is_default: boolean('is_default').notNull().default(false),
    timezone: varchar('timezone', { length: 50 }).notNull().default('UTC'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_book_cal_org').on(table.organization_id),
    index('idx_book_cal_owner').on(table.owner_user_id),
    index('idx_book_cal_project').on(table.project_id),
  ],
);
