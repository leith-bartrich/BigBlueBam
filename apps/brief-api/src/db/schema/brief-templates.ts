import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { users, organizations } from './bbb-refs.js';

const bytea = customType<{ data: Buffer; dpiverInput: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const briefTemplates = pgTable(
  'brief_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 100 }),
    category: varchar('category', { length: 100 }),
    yjs_state: bytea('yjs_state'),
    html_preview: text('html_preview'),
    sort_order: integer('sort_order').default(0).notNull(),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_brief_templates_org_id').on(table.org_id),
    index('idx_brief_templates_category').on(table.category),
  ],
);
