import { pgTable, uuid, varchar, jsonb, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const customFieldDefinitions = pgTable(
  'custom_field_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    field_type: varchar('field_type', { length: 50 }).notNull(),
    options: jsonb('options'),
    is_required: boolean('is_required').default(false).notNull(),
    is_visible_on_card: boolean('is_visible_on_card').default(false).notNull(),
    position: integer('position').default(0).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('custom_field_defs_project_id_idx').on(table.project_id),
  ],
);
