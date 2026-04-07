import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { briefDocuments } from './brief-documents.js';

export const briefEmbeds = pgTable(
  'brief_embeds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    document_id: uuid('document_id')
      .notNull()
      .references(() => briefDocuments.id, { onDelete: 'cascade' }),
    file_name: varchar('file_name', { length: 500 }).notNull(),
    file_size: bigint('file_size', { mode: 'number' }).notNull(),
    mime_type: varchar('mime_type', { length: 255 }).notNull(),
    storage_key: text('storage_key').notNull(),
    width: integer('width'),
    height: integer('height'),
    uploaded_by: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_brief_embeds_document_id').on(table.document_id)],
);
