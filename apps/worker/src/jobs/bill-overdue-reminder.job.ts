/**
 * Bill overdue-invoice reminder sweep (Bill_Plan.md G9).
 *
 * Runs daily (wired in worker.ts) and finds invoices that are past their
 * due_date but not yet paid/void/written_off and have not been nagged in
 * the last 7 days. For each one we send (or log) an overdue reminder,
 * stamp `overdue_reminder_last_sent_at` and bump `overdue_reminder_count`,
 * then emit a `invoice.overdue` Bolt event with source `'bill'`.
 *
 * Idempotency comes from the 7-day window guard on
 * `overdue_reminder_last_sent_at`, so rerunning the same day is a no-op.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { getDb } from '../utils/db.js';
import { publishBoltEvent } from '../utils/bolt-events.js';
import { getSmtpConfig } from '../utils/smtp-config.js';
import type { Env } from '../env.js';

export interface BillOverdueReminderJobData {
  /** Optional: constrain sweep to a single org. */
  organization_id?: string;
  /** Max invoices per run. Defaults to 200. */
  limit?: number;
}

interface OverdueRow {
  id: string;
  organization_id: string;
  invoice_number: string;
  total: number;
  currency: string;
  due_date: string;
  to_email: string | null;
  client_email: string | null;
  client_name: string | null;
  days_overdue: number;
  overdue_reminder_count: number;
}

export async function processBillOverdueReminderJob(
  job: Job<BillOverdueReminderJobData>,
  env: Env,
  logger: Logger,
): Promise<void> {
  const { organization_id, limit } = job.data ?? {};
  const cap = limit ?? 200;
  logger.info({ jobId: job.id, organization_id, limit: cap }, 'bill-overdue-reminder: sweep start');

  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT
      i.id,
      i.organization_id,
      i.invoice_number,
      i.total,
      i.currency,
      i.due_date,
      i.to_email,
      i.overdue_reminder_count,
      c.email AS client_email,
      c.name AS client_name,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - i.due_date::timestamp)) / 86400)::int AS days_overdue
    FROM bill_invoices i
    LEFT JOIN bill_clients c ON c.id = i.client_id
    WHERE i.status NOT IN ('paid', 'void', 'written_off')
      AND i.due_date < NOW()
      AND (
        i.overdue_reminder_last_sent_at IS NULL
        OR i.overdue_reminder_last_sent_at < NOW() - INTERVAL '7 days'
      )
      ${organization_id ? sql`AND i.organization_id = ${organization_id}` : sql``}
    ORDER BY i.due_date ASC
    LIMIT ${cap}
  `);

  const rows = (
    Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? [])
  ) as OverdueRow[];

  if (rows.length === 0) {
    logger.info({ jobId: job.id }, 'bill-overdue-reminder: no overdue invoices, sweep complete');
    return;
  }

  const cfg = await getSmtpConfig(db, env);
  const transport = cfg
    ? nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
      })
    : null;

  let reminded = 0;
  let failed = 0;

  for (const row of rows) {
    const recipient = row.to_email ?? row.client_email;

    try {
      if (recipient) {
        const subject = `Reminder: invoice ${row.invoice_number} is overdue`;
        const greeting = row.client_name ?? 'there';
        const body = [
          `Hi ${greeting},`,
          '',
          `This is a reminder that invoice ${row.invoice_number} for ${row.total} ${row.currency}`,
          `was due on ${row.due_date} and is now ${row.days_overdue} day(s) overdue.`,
          '',
          'Please let us know if you need anything to process payment. Thank you.',
        ].join('\n');

        if (transport && cfg) {
          await transport.sendMail({ from: cfg.from, to: recipient, subject, text: body });
          logger.info({ invoiceId: row.id, to: recipient }, 'bill-overdue-reminder: email sent');
        } else {
          logger.info(
            { invoiceId: row.id, to: recipient, subject, body },
            'bill-overdue-reminder: SMTP not configured, logging reminder',
          );
        }
      } else {
        logger.warn(
          { invoiceId: row.id },
          'bill-overdue-reminder: no recipient email, skipping send but still marking reminded',
        );
      }

      await db.execute(sql`
        UPDATE bill_invoices
        SET
          overdue_reminder_last_sent_at = NOW(),
          overdue_reminder_count = overdue_reminder_count + 1,
          updated_at = NOW()
        WHERE id = ${row.id}
      `);

      await publishBoltEvent(
        'invoice.overdue',
        'bill',
        {
          invoice_id: row.id,
          invoice_number: row.invoice_number,
          days_overdue: row.days_overdue,
          total: row.total,
          currency: row.currency,
          reminder_count: row.overdue_reminder_count + 1,
        },
        row.organization_id,
        undefined,
        'system',
      );

      reminded += 1;
    } catch (err) {
      failed += 1;
      logger.error(
        {
          invoiceId: row.id,
          err: err instanceof Error ? err.message : String(err),
        },
        'bill-overdue-reminder: failed to process invoice',
      );
    }
  }

  logger.info(
    { jobId: job.id, found: rows.length, reminded, failed },
    'bill-overdue-reminder: sweep complete',
  );
}
