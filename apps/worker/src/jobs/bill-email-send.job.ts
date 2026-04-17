/**
 * Bill invoice email-send worker job (Bill_Plan.md G2).
 *
 * Processes `bill_worker_jobs` rows with `job_type = 'email_send'`. For
 * each row we resolve the invoice and its client's email address, then
 * either send a real email via the shared SMTP config (if present) or
 * log the would-have-been send. In both cases the row is flipped to
 * `completed` and `bill_invoices.sent_at` is stamped.
 *
 * Like `bill-pdf-generate`, this job supports two entry modes:
 *   - direct:  { workerJobId } processes a single row
 *   - sweep:   { sweep: true, limit } scans for pending rows
 * The sweep mode is wired to a BullMQ repeatable schedule so the Bill
 * API can keep writing bill_worker_jobs rows without owning a BullMQ
 * queue itself.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { getDb } from '../utils/db.js';
import { publishBoltEvent } from '../utils/bolt-events.js';
import { getSmtpConfig } from '../utils/smtp-config.js';
import type { Env } from '../env.js';

export interface BillEmailSendJobData {
  workerJobId?: string;
  sweep?: boolean;
  limit?: number;
}

interface WorkerJobRow {
  id: string;
  organization_id: string;
  invoice_id: string | null;
}

interface InvoiceClientRow {
  id: string;
  invoice_number: string;
  organization_id: string;
  total: number;
  currency: string;
  due_date: string;
  to_email: string | null;
  client_email: string | null;
  client_name: string | null;
}

async function fetchWorkerJob(id: string): Promise<WorkerJobRow | null> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT id, organization_id, invoice_id
    FROM bill_worker_jobs
    WHERE id = ${id} AND job_type = 'email_send'
    LIMIT 1
  `);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? []);
  return (rows[0] as WorkerJobRow) ?? null;
}

async function fetchInvoiceWithClient(invoiceId: string): Promise<InvoiceClientRow | null> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT
      i.id,
      i.invoice_number,
      i.organization_id,
      i.total,
      i.currency,
      i.due_date,
      i.to_email,
      c.email AS client_email,
      c.name AS client_name
    FROM bill_invoices i
    LEFT JOIN bill_clients c ON c.id = i.client_id
    WHERE i.id = ${invoiceId}
    LIMIT 1
  `);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? []);
  return (rows[0] as InvoiceClientRow) ?? null;
}

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
  env: Env,
  logger: Logger,
): Promise<{ processed: boolean; failed: boolean }> {
  const db = getDb();

  const claimed = await claimWorkerJob(workerJobId);
  if (!claimed) {
    logger.debug({ workerJobId }, 'bill-email-send: row already claimed, skipping');
    return { processed: false, failed: false };
  }

  const jobRow = await fetchWorkerJob(workerJobId);
  if (!jobRow) {
    logger.warn({ workerJobId }, 'bill-email-send: row disappeared after claim');
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
    const invoice = await fetchInvoiceWithClient(jobRow.invoice_id);
    if (!invoice) {
      await db.execute(sql`
        UPDATE bill_worker_jobs
        SET status = 'failed', error_message = 'invoice not found', updated_at = NOW()
        WHERE id = ${workerJobId}
      `);
      return { processed: false, failed: true };
    }

    const recipient = invoice.to_email ?? invoice.client_email;
    if (!recipient) {
      await db.execute(sql`
        UPDATE bill_worker_jobs
        SET status = 'failed', error_message = 'no recipient email', updated_at = NOW()
        WHERE id = ${workerJobId}
      `);
      return { processed: false, failed: true };
    }

    const subject = `Invoice ${invoice.invoice_number} from BigBlueBam`;
    const clientGreeting = invoice.client_name ?? 'there';
    const body = [
      `Hi ${clientGreeting},`,
      '',
      `Your invoice ${invoice.invoice_number} for ${invoice.total} ${invoice.currency} is attached.`,
      `Due date: ${invoice.due_date}.`,
      '',
      'Thank you for your business.',
    ].join('\n');

    const cfg = await getSmtpConfig(db, env);
    if (cfg) {
      const transport = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
      });
      const info = await transport.sendMail({
        from: cfg.from,
        to: recipient,
        subject,
        text: body,
      });
      logger.info(
        { invoiceId: invoice.id, to: recipient, messageId: info.messageId },
        'bill-email-send: invoice email sent',
      );
    } else {
      logger.info(
        { invoiceId: invoice.id, to: recipient, subject, body },
        'bill-email-send: SMTP not configured, logging email instead',
      );
    }

    await db.execute(sql`
      UPDATE bill_invoices
      SET sent_at = COALESCE(sent_at, NOW()), updated_at = NOW()
      WHERE id = ${invoice.id}
    `);

    await db.execute(sql`
      UPDATE bill_worker_jobs
      SET status = 'completed', error_message = NULL, updated_at = NOW()
      WHERE id = ${workerJobId}
    `);

    await publishBoltEvent(
      'invoice.email_sent',
      'bill',
      {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        recipient,
      },
      invoice.organization_id,
      undefined,
      'system',
    );

    return { processed: true, failed: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ workerJobId, err: message }, 'bill-email-send: job failed');
    await db.execute(sql`
      UPDATE bill_worker_jobs
      SET status = 'failed', error_message = ${message.slice(0, 500)}, updated_at = NOW()
      WHERE id = ${workerJobId}
    `);
    return { processed: false, failed: true };
  }
}

async function sweepPendingJobs(limit: number, env: Env, logger: Logger): Promise<void> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT id FROM bill_worker_jobs
    WHERE job_type = 'email_send' AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${limit}
  `);
  const rows = (
    Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? [])
  ) as Array<{ id: string }>;

  if (rows.length === 0) {
    logger.debug('bill-email-send: sweep found no pending rows');
    return;
  }

  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await processWorkerJobRow(row.id, env, logger);
    if (result.processed) processed += 1;
    if (result.failed) failed += 1;
  }
  logger.info(
    { candidates: rows.length, processed, failed },
    'bill-email-send: sweep complete',
  );
}

export async function processBillEmailSendJob(
  job: Job<BillEmailSendJobData>,
  env: Env,
  logger: Logger,
): Promise<void> {
  const data = job.data ?? {};
  if (data.workerJobId) {
    logger.info({ jobId: job.id, workerJobId: data.workerJobId }, 'bill-email-send: direct job');
    await processWorkerJobRow(data.workerJobId, env, logger);
    return;
  }
  const limit = data.limit ?? 25;
  logger.info({ jobId: job.id, limit }, 'bill-email-send: sweep tick');
  await sweepPendingJobs(limit, env, logger);
}
