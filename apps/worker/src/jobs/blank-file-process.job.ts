/**
 * Blank submission file-processing sweep (Blank_Plan.md G4).
 *
 * Picks up submissions where `file_processing_status = 'pending'` and
 * advances them to `'completed'` (or `'failed'` with a small simulated
 * failure rate for demo realism). Populates `processed_files` with stub
 * metadata for each attachment so the frontend has something to render
 * when the real MinIO scanning pipeline arrives in a later wave.
 *
 * Bolt event emission is deliberately omitted, per the plan notes. This
 * is a pure DB state advancer for P0.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

export interface BlankFileProcessJobData {
  /** Optional: scope to a single submission for targeted runs. */
  submission_id?: string;
  /** Max rows per sweep. Defaults to 50. */
  limit?: number;
  /**
   * Force every row to succeed regardless of the random failure roll.
   * Useful in tests. Defaults to false.
   */
  forceSuccess?: boolean;
}

interface PendingSubmissionRow {
  id: string;
  attachments: unknown;
}

function simulateProcessedFiles(attachments: unknown): Record<string, unknown> {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return { files: [], scanned_at: new Date().toISOString() };
  }

  const files = attachments.map((entry, idx) => {
    const name =
      entry && typeof entry === 'object' && 'filename' in entry && typeof (entry as { filename: unknown }).filename === 'string'
        ? (entry as { filename: string }).filename
        : `attachment_${idx}`;
    const size =
      entry && typeof entry === 'object' && 'size' in entry && typeof (entry as { size: unknown }).size === 'number'
        ? (entry as { size: number }).size
        : 0;
    return {
      filename: name,
      size_bytes: size,
      scan_result: 'clean',
      thumbnail_url: null,
      scanned_at: new Date().toISOString(),
    };
  });

  return { files, scanned_at: new Date().toISOString() };
}

async function advanceSubmission(
  row: PendingSubmissionRow,
  forceSuccess: boolean,
  logger: Logger,
): Promise<'completed' | 'failed'> {
  const db = getDb();
  const willFail = !forceSuccess && Math.random() < 0.1;

  if (willFail) {
    await db.execute(sql`
      UPDATE blank_submissions
      SET
        file_processing_status = 'failed',
        file_processing_error = 'simulated virus-scan failure',
        processed_files = ${JSON.stringify({ error: 'simulated', at: new Date().toISOString() })}::jsonb
      WHERE id = ${row.id}
    `);
    logger.info({ submissionId: row.id }, 'blank-file-process: marked failed (demo)');
    return 'failed';
  }

  const processedFiles = simulateProcessedFiles(row.attachments);
  await db.execute(sql`
    UPDATE blank_submissions
    SET
      file_processing_status = 'completed',
      file_processing_error = NULL,
      processed_files = ${JSON.stringify(processedFiles)}::jsonb
    WHERE id = ${row.id}
  `);
  logger.debug({ submissionId: row.id }, 'blank-file-process: marked processed');
  return 'completed';
}

export async function processBlankFileProcessJob(
  job: Job<BlankFileProcessJobData>,
  logger: Logger,
): Promise<void> {
  const { submission_id, limit, forceSuccess } = job.data ?? {};
  const cap = limit ?? 50;
  const db = getDb();

  let rows: PendingSubmissionRow[];
  if (submission_id) {
    const rowsRaw = await db.execute(sql`
      SELECT id, attachments FROM blank_submissions
      WHERE id = ${submission_id} AND file_processing_status = 'pending'
      LIMIT 1
    `);
    rows = (
      Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? [])
    ) as PendingSubmissionRow[];
  } else {
    const rowsRaw = await db.execute(sql`
      SELECT id, attachments FROM blank_submissions
      WHERE file_processing_status = 'pending'
      ORDER BY submitted_at ASC
      LIMIT ${cap}
    `);
    rows = (
      Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? [])
    ) as PendingSubmissionRow[];
  }

  if (rows.length === 0) {
    logger.debug('blank-file-process: no pending submissions');
    return;
  }

  logger.info({ jobId: job.id, candidates: rows.length }, 'blank-file-process: sweep start');

  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const outcome = await advanceSubmission(row, forceSuccess ?? false, logger);
      if (outcome === 'completed') processed += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      logger.error(
        {
          submissionId: row.id,
          err: err instanceof Error ? err.message : String(err),
        },
        'blank-file-process: unexpected error',
      );
    }
  }

  logger.info(
    { jobId: job.id, candidates: rows.length, processed, failed },
    'blank-file-process: sweep complete',
  );
}
