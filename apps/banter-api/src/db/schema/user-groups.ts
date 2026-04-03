import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';

export const banterUserGroups = pgTable(
  'banter_user_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    handle: varchar('handle', { length: 80 }).notNull(),
    description: varchar('description', { length: 500 }),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('banter_user_groups_org_handle_idx').on(table.org_id, table.handle),
    index('banter_user_groups_org_idx').on(table.org_id),
  ],
);
