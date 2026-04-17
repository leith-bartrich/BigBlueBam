import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

export interface BanterRetentionJobData {
  /** When provided, only process this org. When omitted, sweep all orgs. */
  org_id?: string;
}

/**
 * Enforces per-org message/recording/attachment retention policies.
 *
 * For each org with a non-zero message_retention_days setting:
 *   1. Soft-deletes messages older than the cutoff (blanks content)
 *   2. Marks old call recordings for cleanup (nulls recording_storage_key)
 *   3. Removes old message attachments (marks rows for S3 cleanup)
 *   4. Deletes old transcript segments for cleaned-up calls
 *
 * Scheduled as a daily cron job. Also accepts one-off org_id invocations.
 */
export async function processBanterRetentionJob(
  job: Job<BanterRetentionJobData>,
  logger: Logger,
): Promise<void> {
  const db = getDb();
  const targetOrgId = job.data?.org_id;

  // If no org_id, sweep all orgs that have retention configured
  const orgFilter = targetOrgId
    ? sql`AND org_id = ${targetOrgId}`
    : sql``;

  const settingsResult = await db.execute(sql`
    SELECT org_id, message_retention_days
    FROM banter_settings
    WHERE message_retention_days > 0
    ${orgFilter}
  `);

  const rows = (settingsResult as any).rows ?? settingsResult;

  if (!rows || rows.length === 0) {
    logger.info(
      { jobId: job.id, org_id: targetOrgId },
      'No orgs with retention policy configured; nothing to do',
    );
    return;
  }

  let totalMessages = 0;
  let totalRecordings = 0;
  let totalAttachments = 0;
  let totalTranscripts = 0;

  for (const settings of rows) {
    const orgId = settings.org_id;
    const retentionDays = settings.message_retention_days;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffIso = cutoff.toISOString();

    logger.info(
      { org_id: orgId, retentionDays, cutoff: cutoffIso },
      'Enforcing retention for org',
    );

    // 1. Soft-delete old messages (blank content, mark is_deleted)
    const msgResult = await db.execute(sql`
      UPDATE banter_messages
      SET is_deleted = true,
          content = '[Message removed by retention policy]',
          content_plain = '',
          deleted_at = NOW()
      WHERE channel_id IN (
        SELECT id FROM banter_channels WHERE org_id = ${orgId}
      )
      AND created_at < ${cutoffIso}
      AND is_deleted = false
    `);
    const deletedMsgs = (msgResult as any).rowCount ?? 0;
    totalMessages += deletedMsgs;

    // 2. Null out old call recordings (actual S3 cleanup is separate)
    const recResult = await db.execute(sql`
      UPDATE banter_calls
      SET recording_storage_key = NULL
      WHERE channel_id IN (
        SELECT id FROM banter_channels WHERE org_id = ${orgId}
      )
      AND started_at < ${cutoffIso}
      AND recording_storage_key IS NOT NULL
    `);
    const clearedRecs = (recResult as any).rowCount ?? 0;
    totalRecordings += clearedRecs;

    // 3. Mark old message attachments for cleanup
    const attResult = await db.execute(sql`
      DELETE FROM banter_message_attachments
      WHERE message_id IN (
        SELECT m.id FROM banter_messages m
        JOIN banter_channels c ON c.id = m.channel_id
        WHERE c.org_id = ${orgId}
        AND m.created_at < ${cutoffIso}
        AND m.is_deleted = true
      )
    `);
    const deletedAtts = (attResult as any).rowCount ?? 0;
    totalAttachments += deletedAtts;

    // 4. Remove transcript segments for old, ended calls
    const txResult = await db.execute(sql`
      DELETE FROM banter_call_transcripts
      WHERE call_id IN (
        SELECT bc.id FROM banter_calls bc
        JOIN banter_channels c ON c.id = bc.channel_id
        WHERE c.org_id = ${orgId}
        AND bc.started_at < ${cutoffIso}
        AND bc.status = 'ended'
      )
    `);
    const deletedTx = (txResult as any).rowCount ?? 0;
    totalTranscripts += deletedTx;

    logger.info(
      {
        org_id: orgId,
        retentionDays,
        messages: deletedMsgs,
        recordings: clearedRecs,
        attachments: deletedAtts,
        transcripts: deletedTx,
      },
      'Retention enforcement complete for org',
    );
  }

  logger.info(
    {
      jobId: job.id,
      orgs_processed: rows.length,
      totalMessages,
      totalRecordings,
      totalAttachments,
      totalTranscripts,
    },
    'Banter retention sweep complete',
  );
}
