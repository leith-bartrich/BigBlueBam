import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { briefDocuments } from './brief-documents.js';

export const briefCollaboratorPermissionEnum = pgEnum('brief_collaborator_permission', [
  'view',
  'comment',
  'edit',
]);

export const briefCollaborators = pgTable(
  'brief_collaborators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    document_id: uuid('document_id')
      .notNull()
      .references(() => briefDocuments.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    permission: briefCollaboratorPermissionEnum('permission').default('view').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('brief_collaborators_doc_user_key').on(table.document_id, table.user_id),
    index('idx_brief_collaborators_document_id').on(table.document_id),
    index('idx_brief_collaborators_user_id').on(table.user_id),
  ],
);

export const briefStars = pgTable(
  'brief_stars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    document_id: uuid('document_id')
      .notNull()
      .references(() => briefDocuments.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('brief_stars_doc_user_key').on(table.document_id, table.user_id),
    index('idx_brief_stars_document_id').on(table.document_id),
    index('idx_brief_stars_user_id').on(table.user_id),
  ],
);
