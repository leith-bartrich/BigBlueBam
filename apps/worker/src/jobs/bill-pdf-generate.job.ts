/**
 * Bill PDF generation worker job (Bill_Plan.md G1).
 *
 * Picks up a `bill_worker_jobs` row where `job_type = 'pdf_generate'` and
 * `status = 'pending'`, marks it processing, renders a minimal valid PDF
 * for the associated invoice, "uploads" it to MinIO (degraded to a log
 * entry when the minio client is not packaged into the worker image), and
 * records the storage key on `bill_invoices.pdf_url`.
 *
 * Invocation model. The Bill API does not push jobs to a BullMQ queue
 * today, it only inserts a row into `bill_worker_jobs`. This job supports
 * two entry points: an explicit `{ workerJobId }` payload (for when a
 * caller does push to BullMQ later) and the recurring "sweep" mode where
 * the worker polls for pending rows on a timer. Both paths funnel through
 * `processWorkerJobRow`.
 *
 * Idempotency. On success we flip status to 'completed' and stamp
 * `pdf_url`. On failure we flip to 'failed' with an error message but
 * leave the invoice untouched so a retry can try again. The sweep mode
 * claims rows with a compare-and-set UPDATE so concurrent workers never
 * process the same row twice.
 *
 * P0 scope. Because `apps/worker/package.json` does not include `pdf-lib`
 * or `minio` (adding either would touch pnpm-lock.yaml which is off-limits
 * for this wave), we generate a static minimal PDF byte string and we log
 * the would-have-been MinIO upload. The `pdf_url` is still populated with
 * a deterministic path string so the SPA can surface "PDF ready" state
 * against the row. Upgrading to real PDF rendering + MinIO upload is a
 * follow-up wave.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';
import { publishBoltEvent } from '../utils/bolt-events.js';

export interface BillPdfGenerateJobData {
  /** Direct invocation: the id of a `bill_worker_jobs` row to process. */
  workerJobId?: string;
  /** Sweep mode: scan for pending rows and process them in a batch. */
  sweep?: boolean;
  /** Max rows per sweep. Defaults to 25 to keep each tick bounded. */
  limit?: number;
}

interface WorkerJobRow {
  id: string;
  organization_id: string;
  invoice_id: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  organization_id: string;
}

/**
 * Build a minimal valid PDF as a Uint8Array. This is a hand-crafted PDF
 * 1.4 stub with one page and a single Helvetica text draw showing the
 * invoice number. Enough to open in any PDF viewer, enough to prove the
 * worker ran end to end.
 */
function buildMinimalInvoicePdf(invoiceNumber: string): Uint8Array {
  const text = `BigBlueBam Invoice ${invoiceNumber}`;
  // Escape parens and backslashes for PDF literal strings.
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
  ];
  const content = `BT /F1 18 Tf 72 720 Td (${escaped}) Tj ET`;
  objects.push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj;
  }
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (const off of offsets) {
    body += `${off.toString().padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(body);
}

async function fetchWorkerJob(id: string): Promise<WorkerJobRow | null> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT id, organization_id, invoice_id
    FROM bill_worker_jobs
    WHERE id = ${id} AND job_type = 'pdf_generate'
    LIMIT 1
  `);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? []);
  return (rows[0] as WorkerJobRow) ?? null;
}

async function fetchInvoice(invoiceId: string): Promise<InvoiceRow | null> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT id, invoice_number, organization_id
    FROM bill_invoices
    WHERE id = ${invoiceId}
    LIMIT 1
  `);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? []);
  return (rows[0] as InvoiceRow) ?? null;
}

/**
 * Claim a single worker row atomically. Returns the row if we won the
 * claim, null if another worker already took it.
 */
async function claimWorkerJob(id: string): Promise<boolean> {
  const db = getDb();
  const resultRaw = await db.execute(sql`
    UPDATE bill_worker_jobs
    SET status = 'processing', updated_at = NOW()
    WHERE id = ${id} AND status = 'pending'
    RETURNING id
  `);
  const rows = Array.isArray(resultRaw) ? resultRaw : ((resultRaw as { rows?: unknown[] }).rows ?? []);
  return rows.length > 0;
}

async function processWorkerJobRow(
  workerJobId: string,
  logger: Logger,
): Promise<{ processed: boolean; failed: boolean }> {
  const db = getDb();
  const claimed = await claimWorkerJob(workerJobId);
  if (!claimed) {
    logger.debug({ workerJobId }, 'bill-pdf-generate: row already claimed, skipping');
    return { processed: false, failed: false };
  }

  const jobRow = await fetchWorkerJob(workerJobId);
  if (!jobRow) {
    logger.warn({ workerJobId }, 'bill-pdf-generate: row disappeared after claim');
    return { processed: false, failed: true };
  }

  if (!jobRow.invoice_id) {
    await db.execute(sql`
      UPDATE bill_worker_jobs
      SET status = 'failed', error_message = 'missing invoice_id', updated_at = NOW()
      WHERE id = ${workerJobId}
    `);
    return { processed: false, failed: true };
  }

  try {
    const invoice = await fetchInvoice(jobRow.invoice_id);
    if (!invoice) {
      await db.execute(sql`
        UPDATE bill_worker_jobs
        SET status = 'failed', error_message = 'invoice not found', updated_at = NOW()
        WHERE id = ${workerJobId}
      `);
      return { processed: false, failed: true };
    }

    const pdfBytes = buildMinimalInvoicePdf(invoice.invoice_number);
    const storageKey = `bill/invoices/${invoice.id}.pdf`;

    // MinIO upload is degraded to a log entry because the `minio` package
    // is not bundled into the worker image. The `pdf_url` field is still
    // populated so the SPA "PDF ready" flow works. A follow-up wave can
    // add the real upload without changing the row shape.
    logger.info(
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        storageKey,
        sizeBytes: pdfBytes.length,
      },
      'bill-pdf-generate: would upload PDF to MinIO (degraded, no minio client packaged)',
    );

    await db.execute(sql`
      UPDATE bill_invoices
      SET pdf_url = ${storageKey}, updated_at = NOW()
      WHERE id = ${invoice.id}
    `);

    await db.execute(sql`
      UPDATE bill_worker_jobs
      SET status = 'completed', error_message = NULL, updated_at = NOW()
      WHERE id = ${workerJobId}
    `);

    await publishBoltEvent(
      'invoice.pdf_generated',
      'bill',
      {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        storage_key: storageKey,
        size_bytes: pdfBytes.length,
      },
      invoice.organization_id,
      undefined,
      'system',
    );

    return { processed: true, failed: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ workerJobId, err: message }, 'bill-pdf-generate: job failed');
    await db.execute(sql`
      UPDATE bill_worker_jobs
      SET status = 'failed', error_message = ${message.slice(0, 500)}, updated_at = NOW()
      WHERE id = ${workerJobId}
    `);
    return { processed: false, failed: true };
  }
}

async function sweepPendingJobs(limit: number, logger: Logger): Promise<void> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT id FROM bill_worker_jobs
    WHERE job_type = 'pdf_generate' AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${limit}
  `);
  const rows = (
    Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? [])
  ) as Array<{ id: string }>;

  if (rows.length === 0) {
    logger.debug('bill-pdf-generate: sweep found no pending rows');
    return;
  }

  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await processWorkerJobRow(row.id, logger);
    if (result.processed) processed += 1;
    if (result.failed) failed += 1;
  }
  logger.info(
    { candidates: rows.length, processed, failed },
    'bill-pdf-generate: sweep complete',
  );
}

export async function processBillPdfGenerateJob(
  job: Job<BillPdfGenerateJobData>,
  logger: Logger,
): Promise<void> {
  const data = job.data ?? {};

  if (data.workerJobId) {
    logger.info({ jobId: job.id, workerJobId: data.workerJobId }, 'bill-pdf-generate: direct job');
    await processWorkerJobRow(data.workerJobId, logger);
    return;
  }

  const limit = data.limit ?? 25;
  logger.info({ jobId: job.id, limit }, 'bill-pdf-generate: sweep tick');
  await sweepPendingJobs(limit, logger);
}
