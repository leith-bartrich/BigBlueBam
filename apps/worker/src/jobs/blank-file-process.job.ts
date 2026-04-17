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

// ---------------------------------------------------------------------------
// Allowed file extension -> MIME type mapping for content-type validation
// ---------------------------------------------------------------------------

const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  // Images
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
  '.heic': ['image/heic'],
  '.heif': ['image/heif'],
  // Documents
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.csv': ['text/csv', 'application/csv'],
  '.txt': ['text/plain'],
  // Archive
  '.zip': ['application/zip'],
};

/**
 * Validate a single attachment entry by checking its file extension and
 * MIME type against the allowlist. Returns a validation result object.
 */
function validateAttachment(entry: unknown, idx: number): {
  filename: string;
  size_bytes: number;
  scan_result: 'clean' | 'rejected';
  rejection_reason: string | null;
  content_type: string | null;
  scanned_at: string;
} {
  const name =
    entry && typeof entry === 'object' && 'filename' in entry && typeof (entry as { filename: unknown }).filename === 'string'
      ? (entry as { filename: string }).filename
      : `attachment_${idx}`;
  const size =
    entry && typeof entry === 'object' && 'size' in entry && typeof (entry as { size: unknown }).size === 'number'
      ? (entry as { size: number }).size
      : 0;
  const contentType =
    entry && typeof entry === 'object' && 'content_type' in entry && typeof (entry as { content_type: unknown }).content_type === 'string'
      ? (entry as { content_type: string }).content_type
      : entry && typeof entry === 'object' && 'mimetype' in entry && typeof (entry as { mimetype: unknown }).mimetype === 'string'
        ? (entry as { mimetype: string }).mimetype
        : null;

  // Extract extension
  const dotIdx = name.lastIndexOf('.');
  const ext = dotIdx >= 0 ? name.slice(dotIdx).toLowerCase() : '';

  // Check extension allowlist
  const allowedMimes = ALLOWED_FILE_TYPES[ext];
  if (!allowedMimes) {
    return {
      filename: name,
      size_bytes: size,
      scan_result: 'rejected',
      rejection_reason: `Unsupported file extension: ${ext || '(none)'}`,
      content_type: contentType,
      scanned_at: new Date().toISOString(),
    };
  }

  // Cross-check declared MIME type if available
  if (contentType && !allowedMimes.includes(contentType.split(';')[0]!.trim().toLowerCase())) {
    return {
      filename: name,
      size_bytes: size,
      scan_result: 'rejected',
      rejection_reason: `MIME type mismatch: declared ${contentType} but extension is ${ext}`,
      content_type: contentType,
      scanned_at: new Date().toISOString(),
    };
  }

  return {
    filename: name,
    size_bytes: size,
    scan_result: 'clean',
    rejection_reason: null,
    content_type: contentType ?? allowedMimes[0]!,
    scanned_at: new Date().toISOString(),
  };
}

function processAttachments(attachments: unknown): {
  files: ReturnType<typeof validateAttachment>[];
  scanned_at: string;
  all_clean: boolean;
} {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return { files: [], scanned_at: new Date().toISOString(), all_clean: true };
  }

  const files = attachments.map((entry, idx) => validateAttachment(entry, idx));
  const all_clean = files.every((f) => f.scan_result === 'clean');

  return { files, scanned_at: new Date().toISOString(), all_clean };
}

async function advanceSubmission(
  row: PendingSubmissionRow,
  _forceSuccess: boolean,
  logger: Logger,
): Promise<'completed' | 'failed'> {
  const db = getDb();

  const result = processAttachments(row.attachments);

  if (!result.all_clean) {
    const rejectedFiles = result.files.filter((f) => f.scan_result === 'rejected');
    const errorMessage = rejectedFiles
      .map((f) => `${f.filename}: ${f.rejection_reason}`)
      .join('; ');

    await db.execute(sql`
      UPDATE blank_submissions
      SET
        file_processing_status = 'failed',
        file_processing_error = ${errorMessage.slice(0, 500)},
        processed_files = ${JSON.stringify(result)}::jsonb
      WHERE id = ${row.id}
    `);
    logger.info(
      { submissionId: row.id, rejectedCount: rejectedFiles.length },
      'blank-file-process: files rejected by content-type validation',
    );
    return 'failed';
  }

  await db.execute(sql`
    UPDATE blank_submissions
    SET
      file_processing_status = 'completed',
      file_processing_error = NULL,
      processed_files = ${JSON.stringify(result)}::jsonb
    WHERE id = ${row.id}
  `);
  logger.debug({ submissionId: row.id }, 'blank-file-process: all files validated');
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
