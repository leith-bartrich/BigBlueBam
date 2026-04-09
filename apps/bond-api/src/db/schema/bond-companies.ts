import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  bigint,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';

export const bondCompanies = pgTable(
  'bond_companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 }).notNull(),
    domain: varchar('domain', { length: 255 }),
    industry: varchar('industry', { length: 100 }),
    size_bucket: varchar('size_bucket', { length: 30 }),
    annual_revenue: bigint('annual_revenue', { mode: 'number' }),
    phone: varchar('phone', { length: 50 }),
    website: text('website'),
    logo_url: text('logo_url'),

    address_line1: varchar('address_line1', { length: 255 }),
    address_line2: varchar('address_line2', { length: 255 }),
    city: varchar('city', { length: 100 }),
    state_region: varchar('state_region', { length: 100 }),
    postal_code: varchar('postal_code', { length: 20 }),
    country: varchar('country', { length: 2 }),

    custom_fields: jsonb('custom_fields').default({}).notNull(),
    owner_id: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bond_companies_org').on(table.organization_id),
    index('idx_bond_companies_domain').on(table.organization_id, table.domain),
    index('idx_bond_companies_name').on(table.organization_id, table.name),
  ],
);
