import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { organizations } from './bbb-refs.js';

/**
 * bond_import_mappings — tracks source-to-Bond entity mappings for the
 * express-interest migration pipeline (and future import-from-other-systems
 * workflows). One row per external record, deduped via
 * (organization_id, source_system, source_id).
 *
 * Added in migration 0099_bond_import_mappings.sql.
 */
export const bondImportMappings = pgTable(
  'bond_import_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Origin of the record being imported (for example "express-interest",
    // "trello-board-xyz", "legacy-crm"). Free-form but capped at 60 chars.
    source_system: varchar('source_system', { length: 60 }).notNull(),

    // The opaque identifier the source system uses for the record. Combined
    // with source_system and organization_id, this forms the dedup key.
    source_id: varchar('source_id', { length: 255 }).notNull(),

    // One of 'contact', 'company', 'deal'. Enforced by a CHECK constraint in
    // the migration; mirrored here as varchar(20) to keep Drizzle in sync.
    bond_entity_type: varchar('bond_entity_type', { length: 20 }).notNull(),

    // Foreign key is intentionally NOT enforced at the DB level because the
    // same column can point into three different tables. Application code is
    // responsible for ensuring the target row exists.
    bond_entity_id: uuid('bond_entity_id').notNull(),

    imported_at: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bond_import_mappings_org').on(table.organization_id),
    index('idx_bond_import_mappings_source').on(
      table.organization_id,
      table.source_system,
      table.source_id,
    ),
    index('idx_bond_import_mappings_entity').on(
      table.bond_entity_type,
      table.bond_entity_id,
    ),
    unique('bond_import_mappings_org_source_uk').on(
      table.organization_id,
      table.source_system,
      table.source_id,
    ),
  ],
);
