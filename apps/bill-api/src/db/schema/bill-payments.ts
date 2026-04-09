import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';
import { billInvoices } from './bill-invoices.js';

export const billPayments = pgTable(
  'bill_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoice_id: uuid('invoice_id')
      .notNull()
      .references(() => billInvoices.id, { onDelete: 'cascade' }),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    payment_method: varchar('payment_method', { length: 30 }),
    reference: varchar('reference', { length: 255 }),
    notes: text('notes'),
    paid_at: date('paid_at').notNull().defaultNow(),
    recorded_by: uuid('recorded_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bill_payments_invoice').on(table.invoice_id),
    index('idx_bill_payments_org').on(table.organization_id),
  ],
);
