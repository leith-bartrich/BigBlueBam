/**
 * Bench scheduled-report delivery job (Bench_Plan.md G1).
 *
 * Simulates rendering + delivery of a `bench_scheduled_reports` row by
 * stamping `last_delivery_attempt_at` and setting `last_delivery_status`
 * to `'delivered'` (or `'failed'` when invoked in demo-failure mode).
 * Bumps `last_sent_at` on success so the scheduler view reflects the
 * latest successful delivery.
 *
 * Emits `report.delivered` Bolt event with source `'bench'`.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';
import { publishBoltEvent } from '../utils/bolt-events.js';

export interface BenchReportDeliverJobData {
  /** Direct mode: deliver a specific report. */
  report_id?: string;
  /** Demo-failure mode: mark the row as failed rather than delivered. */
  simulateFailure?: boolean;
  /** Sweep cap. Defaults to 25. */
  limit?: number;
}

interface ReportRow {
  id: string;
  organization_id: string;
  dashboard_id: string;
  name: string;
  delivery_method: string;
  delivery_target: string;
  export_format: string;
}

async function fetchReport(reportId: string): Promise<ReportRow | null> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT id, organization_id, dashboard_id, name, delivery_method, delivery_target, export_format
    FROM bench_scheduled_reports
    WHERE id = ${reportId}
    LIMIT 1
  `);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? []);
  return (rows[0] as ReportRow) ?? null;
}

async function fetchDueReports(limit: number): Promise<ReportRow[]> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT id, organization_id, dashboard_id, name, delivery_method, delivery_target, export_format
    FROM bench_scheduled_reports
    WHERE enabled = true
      AND (
        last_sent_at IS NULL
        OR last_sent_at < NOW() - INTERVAL '1 day'
      )
    ORDER BY last_sent_at NULLS FIRST, created_at ASC
    LIMIT ${limit}
  `);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? []);
  return rows as ReportRow[];
}

async function deliverReport(
  report: ReportRow,
  simulateFailure: boolean,
  logger: Logger,
): Promise<'delivered' | 'failed'> {
  const db = getDb();

  if (simulateFailure) {
    await db.execute(sql`
      UPDATE bench_scheduled_reports
      SET
        last_delivery_attempt_at = NOW(),
        last_delivery_status = 'failed',
        last_delivery_error = 'simulated failure for demo',
        updated_at = NOW()
      WHERE id = ${report.id}
    `);
    logger.info({ reportId: report.id, name: report.name }, 'bench-report-deliver: simulated failure');
    return 'failed';
  }

  logger.info(
    {
      reportId: report.id,
      name: report.name,
      deliveryMethod: report.delivery_method,
      deliveryTarget: report.delivery_target,
      exportFormat: report.export_format,
    },
    'bench-report-deliver: simulating delivery (stub)',
  );

  await db.execute(sql`
    UPDATE bench_scheduled_reports
    SET
      last_delivery_attempt_at = NOW(),
      last_delivery_status = 'delivered',
      last_delivery_error = NULL,
      last_sent_at = NOW(),
      updated_at = NOW()
    WHERE id = ${report.id}
  `);

  await publishBoltEvent(
    'report.delivered',
    'bench',
    {
      report_id: report.id,
      dashboard_id: report.dashboard_id,
      name: report.name,
      delivery_method: report.delivery_method,
      delivery_target: report.delivery_target,
      export_format: report.export_format,
    },
    report.organization_id,
    undefined,
    'system',
  );

  return 'delivered';
}

export async function processBenchReportDeliverJob(
  job: Job<BenchReportDeliverJobData>,
  logger: Logger,
): Promise<void> {
  const { report_id, simulateFailure, limit } = job.data ?? {};

  if (report_id) {
    const report = await fetchReport(report_id);
    if (!report) {
      logger.warn({ reportId: report_id }, 'bench-report-deliver: report not found');
      return;
    }
    await deliverReport(report, simulateFailure ?? false, logger);
    return;
  }

  const cap = limit ?? 25;
  const reports = await fetchDueReports(cap);
  if (reports.length === 0) {
    logger.debug('bench-report-deliver: no due reports');
    return;
  }

  logger.info({ jobId: job.id, candidates: reports.length }, 'bench-report-deliver: sweep start');

  let delivered = 0;
  let failed = 0;
  for (const report of reports) {
    try {
      const outcome = await deliverReport(report, simulateFailure ?? false, logger);
      if (outcome === 'delivered') delivered += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      logger.error(
        {
          reportId: report.id,
          err: err instanceof Error ? err.message : String(err),
        },
        'bench-report-deliver: unexpected error',
      );
    }
  }

  logger.info(
    { jobId: job.id, candidates: reports.length, delivered, failed },
    'bench-report-deliver: sweep complete',
  );
}
