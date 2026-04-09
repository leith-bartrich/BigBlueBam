import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';

export const billClients = pgTable(
  'bill_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    address_line1: varchar('address_line1', { length: 255 }),
    address_line2: varchar('address_line2', { length: 255 }),
    city: varchar('city', { length: 100 }),
    state_region: varchar('state_region', { length: 100 }),
    postal_code: varchar('postal_code', { length: 20 }),
    country: varchar('country', { length: 2 }),
    tax_id: varchar('tax_id', { length: 50 }),
    bond_company_id: uuid('bond_company_id'),
    default_payment_terms_days: integer('default_payment_terms_days').notNull().default(30),
    default_payment_instructions: text('default_payment_instructions'),
    notes: text('notes'),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bill_clients_org').on(table.organization_id),
  ],
);
