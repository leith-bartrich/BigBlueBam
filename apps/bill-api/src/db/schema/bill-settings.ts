import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { organizations } from './bbb-refs.js';

export const billSettings = pgTable('bill_settings', {
  organization_id: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  company_name: varchar('company_name', { length: 255 }),
  company_email: varchar('company_email', { length: 255 }),
  company_phone: varchar('company_phone', { length: 50 }),
  company_address: text('company_address'),
  company_logo_url: text('company_logo_url'),
  company_tax_id: varchar('company_tax_id', { length: 50 }),
  default_currency: varchar('default_currency', { length: 3 }).notNull().default('USD'),
  default_tax_rate: numeric('default_tax_rate', { precision: 5, scale: 2 }).default('0'),
  default_payment_terms_days: integer('default_payment_terms_days').notNull().default(30),
  default_payment_instructions: text('default_payment_instructions'),
  default_footer_text: text('default_footer_text'),
  default_terms_text: text('default_terms_text'),
  invoice_prefix: varchar('invoice_prefix', { length: 20 }).notNull().default('INV'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
