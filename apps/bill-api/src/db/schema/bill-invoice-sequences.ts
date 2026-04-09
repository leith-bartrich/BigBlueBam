import {
  pgTable,
  uuid,
  varchar,
  integer,
} from 'drizzle-orm/pg-core';
import { organizations } from './bbb-refs.js';

export const billInvoiceSequences = pgTable('bill_invoice_sequences', {
  organization_id: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  prefix: varchar('prefix', { length: 20 }).notNull().default('INV'),
  next_number: integer('next_number').notNull().default(1),
  format_pattern: varchar('format_pattern', { length: 50 })
    .notNull()
    .default('{prefix}-{number:05d}'),
});
