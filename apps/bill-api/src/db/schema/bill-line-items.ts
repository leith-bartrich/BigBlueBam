import {
  pgTable,
  uuid,
  text,
  numeric,
  varchar,
  bigint,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { billInvoices } from './bill-invoices.js';

export const billLineItems = pgTable(
  'bill_line_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoice_id: uuid('invoice_id')
      .notNull()
      .references(() => billInvoices.id, { onDelete: 'cascade' }),
    sort_order: integer('sort_order').notNull().default(0),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
    unit: varchar('unit', { length: 20 }).default('hours'),
    unit_price: bigint('unit_price', { mode: 'number' }).notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    time_entry_ids: uuid('time_entry_ids').array(),
    task_id: uuid('task_id'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bill_items_invoice').on(table.invoice_id, table.sort_order),
  ],
);
