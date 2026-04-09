import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  jsonb,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { organizations } from './bbb-refs.js';

export const bondCustomFieldDefinitions = pgTable(
  'bond_custom_field_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    entity_type: varchar('entity_type', { length: 20 }).notNull(),
    field_key: varchar('field_key', { length: 60 }).notNull(),
    label: varchar('label', { length: 100 }).notNull(),
    field_type: varchar('field_type', { length: 20 }).notNull(),
    options: jsonb('options'),
    required: boolean('required').notNull().default(false),
    sort_order: integer('sort_order').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('bond_cfd_org_entity_key').on(table.organization_id, table.entity_type, table.field_key),
  ],
);
