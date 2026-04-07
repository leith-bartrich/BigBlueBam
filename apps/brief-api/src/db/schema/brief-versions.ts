import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  unique,
  customType,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { briefDocuments } from './brief-documents.js';

const bytea = customType<{ data: Buffer; driverInput: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const briefVersions = pgTable(
  'brief_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    document_id: uuid('document_id')
      .notNull()
      .references(() => briefDocuments.id, { onDelete: 'cascade' }),
    version_number: integer('version_number').notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    yjs_state: bytea('yjs_state'),
    html_snapshot: text('html_snapshot'),
    plain_text: text('plain_text'),
    word_count: integer('word_count').default(0).notNull(),
    change_summary: text('change_summary'),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('brief_versions_document_id_version_number_key').on(
      table.document_id,
      table.version_number,
    ),
    index('idx_brief_versions_document_id').on(table.document_id),
  ],
);
