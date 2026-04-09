import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  boolean,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users, projects } from './bbb-refs.js';
import { billInvoices } from './bill-invoices.js';

export const billExpenses = pgTable(
  'bill_expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    project_id: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    category: varchar('category', { length: 60 }),
    vendor: varchar('vendor', { length: 255 }),
    expense_date: date('expense_date').notNull().defaultNow(),
    receipt_url: text('receipt_url'),
    receipt_filename: varchar('receipt_filename', { length: 255 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    approved_by: uuid('approved_by').references(() => users.id),
    billable: boolean('billable').notNull().default(false),
    invoiced: boolean('invoiced').notNull().default(false),
    invoice_id: uuid('invoice_id').references(() => billInvoices.id, { onDelete: 'set null' }),
    submitted_by: uuid('submitted_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bill_expenses_org').on(table.organization_id),
    index('idx_bill_expenses_project').on(table.project_id),
    index('idx_bill_expenses_status').on(table.status),
  ],
);
