import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';

export const blastTemplates = pgTable(
  'blast_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    subject_template: varchar('subject_template', { length: 500 }).notNull(),
    html_body: text('html_body').notNull(),
    json_design: jsonb('json_design'),
    plain_text_body: text('plain_text_body'),
    template_type: varchar('template_type', { length: 20 }).notNull().default('campaign'),
    thumbnail_url: text('thumbnail_url'),
    version: integer('version').notNull().default(1),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updated_by: uuid('updated_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_blast_templates_org').on(table.organization_id),
  ],
);
