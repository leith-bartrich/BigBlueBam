import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  customType,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const boardTemplates = pgTable('board_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  icon: varchar('icon', { length: 10 }),
  yjs_state: bytea('yjs_state'),
  thumbnail_url: varchar('thumbnail_url', { length: 2048 }),
  sort_order: integer('sort_order').default(0).notNull(),
  created_by: uuid('created_by')
    .notNull()
    .references(() => users.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
