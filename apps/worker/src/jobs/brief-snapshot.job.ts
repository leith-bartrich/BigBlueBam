/**
 * Brief document snapshot job.
 *
 * Creates periodic version snapshots of Brief documents that have been
 * modified since their last snapshot. This preserves document history so
 * users can browse and restore previous versions.
 *
 * Runs on a daily schedule (4 AM UTC) and processes up to `limit` documents
 * per tick. For each stale document it:
 *   1. Reads the current plain_text and html_snapshot from brief_documents.
 *   2. Determines the next version_number from brief_versions.
 *   3. Inserts a new brief_versions row with the current content.
 *   4. Emits a `document.snapshot_created` Bolt event.
 *
 * Can also be triggered ad-hoc for a single document or org.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';
import { publishBoltEvent } from '../utils/bolt-events.js';

export interface BriefSnapshotJobData {
  /** Optional: snapshot a single document. */
  document_id?: string;
  /** Optional: scope to a single org. */
  org_id?: string;
  /** Max documents per tick. Defaults to 100. */
  limit?: number;
}

interface SnapshotCandidate {
  id: string;
  org_id: string;
  title: string;
  plain_text: string | null;
  html_snapshot: string | null;
  word_count: number;
  updated_at: Date;
  created_by: string;
  updated_by: string | null;
}

async function fetchCandidates(
  orgId: string | undefined,
  documentId: string | undefined,
  limit: number,
): Promise<SnapshotCandidate[]> {
  const db = getDb();
  // Find documents updated since their latest version snapshot
  const rowsRaw = await db.execute(sql`
    SELECT d.id, d.org_id, d.title, d.plain_text, d.html_snapshot,
           d.word_count, d.updated_at, d.created_by, d.updated_by
    FROM brief_documents d
    WHERE d.archived_at IS NULL
      AND d.updated_at > COALESCE(
        (SELECT MAX(v.created_at) FROM brief_versions v WHERE v.document_id = d.id),
        d.created_at
      )
      ${orgId ? sql`AND d.org_id = ${orgId}` : sql``}
      ${documentId ? sql`AND d.id = ${documentId}` : sql``}
    ORDER BY d.updated_at ASC
    LIMIT ${limit}
  `);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? []);
  return rows as SnapshotCandidate[];
}

async function getNextVersionNumber(docId: string): Promise<number> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
    FROM brief_versions
    WHERE document_id = ${docId}
  `);
  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
  const row = rows[0] as { next_version: number } | undefined;
  return row?.next_version ?? 1;
}

async function createSnapshot(
  doc: SnapshotCandidate,
  versionNumber: number,
): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    INSERT INTO brief_versions (document_id, version_number, title, plain_text, html_snapshot, word_count, created_by)
    VALUES (
      ${doc.id},
      ${versionNumber},
      ${doc.title},
      ${doc.plain_text},
      ${doc.html_snapshot},
      ${doc.word_count},
      ${doc.updated_by ?? doc.created_by}
    )
  `);
}

export async function processBriefSnapshotJob(
  job: Job<BriefSnapshotJobData>,
  logger: Logger,
): Promise<void> {
  const { document_id, org_id, limit } = job.data ?? {};
  const cap = limit ?? 100;
  logger.info({ jobId: job.id, document_id, org_id, limit: cap }, 'brief-snapshot: tick start');

  const candidates = await fetchCandidates(org_id, document_id, cap);
  if (candidates.length === 0) {
    logger.debug('brief-snapshot: no documents need snapshots');
    return;
  }

  let snapshotted = 0;
  let failed = 0;

  for (const doc of candidates) {
    try {
      const versionNumber = await getNextVersionNumber(doc.id);
      await createSnapshot(doc, versionNumber);

      await publishBoltEvent(
        'document.snapshot_created',
        'brief',
        {
          document_id: doc.id,
          version_number: versionNumber,
          word_count: doc.word_count,
        },
        doc.org_id,
        doc.updated_by ?? doc.created_by,
        'system',
      );

      snapshotted += 1;
    } catch (err) {
      failed += 1;
      logger.error(
        {
          documentId: doc.id,
          err: err instanceof Error ? err.message : String(err),
        },
        'brief-snapshot: failed to create snapshot',
      );
    }
  }

  logger.info(
    { jobId: job.id, candidates: candidates.length, snapshotted, failed },
    'brief-snapshot: tick complete',
  );
}
