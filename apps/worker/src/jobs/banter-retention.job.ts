import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

export interface BanterRetentionJobData {
  org_id: string;
}

/**
 * Processes message/recording/attachment cleanup per org retention settings.
 * Should be scheduled as a recurring job (e.g., daily via cron).
 */
export async function processBanterRetentionJob(
  job: Job<BanterRetentionJobData>,
  logger: Logger,
): Promise<void> {
  const { org_id } = job.data;
  logger.info({ jobId: job.id, org_id }, 'Processing Banter retention job');

  const db = getDb();

  // Get retention settings for the org
  const settingsResult = await db.execute(sql`
    SELECT message_retention_days
    FROM banter_settings
    WHERE org_id = ${org_id}
    LIMIT 1
  `);

  const settings = (settingsResult as any)[0] ?? (settingsResult as any).rows?.[0];
  const retentionDays = settings?.message_retention_days ?? 0;

  if (retentionDays <= 0) {
    logger.info({ org_id }, 'Retention is set to unlimited, skipping cleanup');
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffIso = cutoff.toISOString();

  // Soft-delete old messages (set is_deleted = true)
  const msgResult = await db.execute(sql`
    UPDATE banter_messages
    SET is_deleted = true, content = '[Message removed by retention policy]', content_plain = ''
    WHERE channel_id IN (
      SELECT id FROM banter_channels WHERE org_id = ${org_id}
    )
    AND created_at < ${cutoffIso}
    AND is_deleted = false
  `);

  const deletedCount = (msgResult as any).rowCount ?? 0;

  // Clean up old call recordings (mark for deletion)
  await db.execute(sql`
    UPDATE banter_calls
    SET recording_url = NULL
    WHERE channel_id IN (
      SELECT id FROM banter_channels WHERE org_id = ${org_id}
    )
    AND started_at < ${cutoffIso}
    AND recording_url IS NOT NULL
  `);

  logger.info(
    { jobId: job.id, org_id, retentionDays, deletedCount },
    'Banter retention job completed',
  );
}
