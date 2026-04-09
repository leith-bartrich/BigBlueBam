import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { organizations, projects, users } from './bbb-refs.js';
import { boardTemplates } from './board-templates.js';

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const boards = pgTable(
  'boards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    project_id: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 10 }),
    yjs_state: bytea('yjs_state'),
    thumbnail_url: varchar('thumbnail_url', { length: 2048 }),
    template_id: uuid('template_id').references(() => boardTemplates.id, { onDelete: 'set null' }),
    background: varchar('background', { length: 20 }).default('dots').notNull(),
    locked: boolean('locked').default(false).notNull(),
    visibility: varchar('visibility', { length: 20 }).default('project').notNull(),
    default_viewport: jsonb('default_viewport'),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updated_by: uuid('updated_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    archived_at: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_boards_organization_id').on(table.organization_id),
    index('idx_boards_project_id').on(table.project_id),
    index('idx_boards_created_by').on(table.created_by),
  ],
);
