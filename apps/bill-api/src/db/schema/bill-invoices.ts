import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  numeric,
  integer,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users, projects } from './bbb-refs.js';
import { billClients } from './bill-clients.js';

export const billInvoices = pgTable(
  'bill_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    client_id: uuid('client_id')
      .notNull()
      .references(() => billClients.id, { onDelete: 'restrict' }),
    project_id: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    invoice_number: varchar('invoice_number', { length: 50 }).notNull(),
    invoice_date: date('invoice_date').notNull().defaultNow(),
    due_date: date('due_date').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
    tax_rate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0'),
    tax_amount: bigint('tax_amount', { mode: 'number' }).notNull().default(0),
    discount_amount: bigint('discount_amount', { mode: 'number' }).notNull().default(0),
    total: bigint('total', { mode: 'number' }).notNull().default(0),
    amount_paid: bigint('amount_paid', { mode: 'number' }).notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    from_name: varchar('from_name', { length: 255 }),
    from_email: varchar('from_email', { length: 255 }),
    from_address: text('from_address'),
    from_logo_url: text('from_logo_url'),
    from_tax_id: varchar('from_tax_id', { length: 50 }),
    to_name: varchar('to_name', { length: 255 }),
    to_email: varchar('to_email', { length: 255 }),
    to_address: text('to_address'),
    to_tax_id: varchar('to_tax_id', { length: 50 }),
    payment_terms_days: integer('payment_terms_days').notNull().default(30),
    payment_instructions: text('payment_instructions'),
    notes: text('notes'),
    footer_text: text('footer_text'),
    terms_text: text('terms_text'),
    bond_deal_id: uuid('bond_deal_id'),
    pdf_url: text('pdf_url'),
    public_view_token: varchar('public_view_token', { length: 64 }),
    sent_at: timestamp('sent_at', { withTimezone: true }),
    viewed_at: timestamp('viewed_at', { withTimezone: true }),
    paid_at: timestamp('paid_at', { withTimezone: true }),
    overdue_reminder_sent_at: timestamp('overdue_reminder_sent_at', { withTimezone: true }),
    // Added by migration 0086_bill_pdf_storage_and_locks.sql.
    // pdf_generation_locked_* lets a worker claim a row for async PDF generation
    // without racing another worker; overdue_reminder_* tracks idempotent
    // overdue reminder fan-out so we never spam a customer twice in the same
    // window.
    pdf_generation_locked_at: timestamp('pdf_generation_locked_at', { withTimezone: true }),
    pdf_generation_locked_by: varchar('pdf_generation_locked_by', { length: 100 }),
    overdue_reminder_count: integer('overdue_reminder_count').notNull().default(0),
    overdue_reminder_last_sent_at: timestamp('overdue_reminder_last_sent_at', {
      withTimezone: true,
    }),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bill_invoices_org').on(table.organization_id),
    index('idx_bill_invoices_client').on(table.client_id),
    index('idx_bill_invoices_project').on(table.project_id),
    index('idx_bill_invoices_status').on(table.status),
    index('idx_bill_invoices_number').on(table.organization_id, table.invoice_number),
    index('idx_bill_invoices_token').on(table.public_view_token),
  ],
);
