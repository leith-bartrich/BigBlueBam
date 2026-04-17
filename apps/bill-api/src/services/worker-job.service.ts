import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { billWorkerJobs } from '../db/schema/index.js';
import type {
  BillWorkerJobStatus,
  BillWorkerJobType,
} from '../db/schema/bill-worker-jobs.js';

/**
 * Small service wrapper around bill_worker_jobs.
 *
 * The Bill API enqueues async work by writing a row here and, eventually,
 * publishing a BullMQ job id. The actual job handlers live in apps/worker
 * and update these rows as they progress. Until those handlers ship, the
 * row is still useful: it records that work was requested, lets the SPA
 * display "PDF generating..." status, and gives operators a queryable
 * audit trail of pending or failed async operations.
 *
 * All helpers are org scoped so callers cannot accidentally read or
 * mutate another tenant's job state.
 */

export interface EnqueueJobInput {
  organization_id: string;
  invoice_id?: string;
  expense_id?: string;
  job_type: BillWorkerJobType;
}

export async function enqueueWorkerJob(input: EnqueueJobInput) {
  const [row] = await db
    .insert(billWorkerJobs)
    .values({
      organization_id: input.organization_id,
      invoice_id: input.invoice_id,
      expense_id: input.expense_id,
      job_type: input.job_type,
      status: 'pending',
    })
    .returning();
  return row!;
}

export async function markJobProcessing(id: string, orgId: string) {
  const [row] = await db
    .update(billWorkerJobs)
    .set({ status: 'processing', updated_at: new Date() })
    .where(
      and(eq(billWorkerJobs.id, id), eq(billWorkerJobs.organization_id, orgId)),
    )
    .returning();
  return row ?? null;
}

export async function markJobCompleted(id: string, orgId: string) {
  const [row] = await db
    .update(billWorkerJobs)
    .set({
      status: 'completed',
      error_message: null,
      updated_at: new Date(),
    })
    .where(
      and(eq(billWorkerJobs.id, id), eq(billWorkerJobs.organization_id, orgId)),
    )
    .returning();
  return row ?? null;
}

export async function markJobFailed(
  id: string,
  orgId: string,
  errorMessage: string,
) {
  const [row] = await db
    .update(billWorkerJobs)
    .set({
      status: 'failed',
      error_message: errorMessage,
      retry_count: 0,
      updated_at: new Date(),
    })
    .where(
      and(eq(billWorkerJobs.id, id), eq(billWorkerJobs.organization_id, orgId)),
    )
    .returning();
  return row ?? null;
}

/**
 * Most recent job row for an invoice of a given type. Used by the SPA to
 * render "PDF generating..." or "Email queued..." status chips on the
 * invoice detail page without querying BullMQ directly.
 */
export async function latestJobForInvoice(
  orgId: string,
  invoiceId: string,
  jobType: BillWorkerJobType,
) {
  const [row] = await db
    .select()
    .from(billWorkerJobs)
    .where(
      and(
        eq(billWorkerJobs.organization_id, orgId),
        eq(billWorkerJobs.invoice_id, invoiceId),
        eq(billWorkerJobs.job_type, jobType),
      ),
    )
    .orderBy(desc(billWorkerJobs.created_at))
    .limit(1);
  return row ?? null;
}

export type { BillWorkerJobStatus, BillWorkerJobType };
