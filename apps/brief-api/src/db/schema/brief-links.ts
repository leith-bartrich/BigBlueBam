import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users, tasks, beaconEntries } from './bbb-refs.js';
import { briefDocuments } from './brief-documents.js';

export const briefTaskLinkTypeEnum = pgEnum('brief_task_link_type', [
  'reference',
  'spec',
  'notes',
  'postmortem',
]);

export const briefBeaconLinkTypeEnum = pgEnum('brief_beacon_link_type', [
  'reference',
  'source',
  'related',
]);

export const briefTaskLinks = pgTable(
  'brief_task_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    document_id: uuid('document_id')
      .notNull()
      .references(() => briefDocuments.id, { onDelete: 'cascade' }),
    task_id: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    link_type: briefTaskLinkTypeEnum('link_type').default('reference').notNull(),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('brief_task_links_doc_task_type_key').on(
      table.document_id,
      table.task_id,
      table.link_type,
    ),
    index('idx_brief_task_links_document_id').on(table.document_id),
    index('idx_brief_task_links_task_id').on(table.task_id),
  ],
);

export const briefBeaconLinks = pgTable(
  'brief_beacon_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    document_id: uuid('document_id')
      .notNull()
      .references(() => briefDocuments.id, { onDelete: 'cascade' }),
    beacon_id: uuid('beacon_id')
      .notNull()
      .references(() => beaconEntries.id, { onDelete: 'cascade' }),
    link_type: briefBeaconLinkTypeEnum('link_type').default('reference').notNull(),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('brief_beacon_links_doc_beacon_type_key').on(
      table.document_id,
      table.beacon_id,
      table.link_type,
    ),
    index('idx_brief_beacon_links_document_id').on(table.document_id),
    index('idx_brief_beacon_links_beacon_id').on(table.beacon_id),
  ],
);
