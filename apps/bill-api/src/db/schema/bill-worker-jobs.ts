import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './bbb-refs.js';
import { billInvoices } from './bill-invoices.js';
import { billExpenses } from './bill-expenses.js';

/**
 * bill_worker_jobs tracks the state of async jobs spawned by the Bill API so
 * we can observe retries, surface failures, and dedupe work across restarts.
 *
 * Created by migration 0088_bill_worker_job_state.sql. Currently enqueued
 * directly from the bill-api (pdf_generate on finalize, email_send on send),
 * with the actual BullMQ handlers in apps/worker deferred. The row acts as a
 * visible placeholder until the worker-side handlers land and start
 * advancing status from pending to processing and completed or failed.
 *
 * Only one of invoice_id or expense_id will be set per row.
 */
export const billWorkerJobs = pgTable(
  'bill_worker_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    invoice_id: uuid('invoice_id').references(() => billInvoices.id, {
      onDelete: 'cascade',
    }),
    expense_id: uuid('expense_id').references(() => billExpenses.id, {
      onDelete: 'cascade',
    }),
    job_type: varchar('job_type', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    error_message: text('error_message'),
    retry_count: integer('retry_count').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bill_worker_jobs_org').on(table.organization_id),
    index('idx_bill_worker_jobs_invoice').on(table.invoice_id, table.job_type),
    index('idx_bill_worker_jobs_status').on(table.status, table.created_at),
  ],
);

export type BillWorkerJobType = 'pdf_generate' | 'email_send' | 'reminder_check';
export type BillWorkerJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
