/**
 * Bearing snapshot job — daily KR progress persistence.
 *
 * Runs at midnight UTC via cron. For every active period, captures a
 * point-in-time snapshot of each Key Result's current_value and progress
 * into bearing_kr_snapshots. Idempotent: uses UPSERT keyed on
 * (key_result_id, snapshot_date).
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BearingSnapshotJobData {
  /** Optional: scope to a single organization */
  organization_id?: string;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processBearingSnapshotJob(
  job: Job<BearingSnapshotJobData>,
  logger: Logger,
): Promise<void> {
  const { organization_id } = job.data;
  logger.info({ jobId: job.id, organization_id }, 'Starting bearing snapshot job');

  const db = getDb();

  // Get all active periods (status = 'active')
  const activePeriods: any[] = await db.execute(sql`
    SELECT id FROM bearing_periods
    WHERE status = 'active'
    ${organization_id ? sql`AND organization_id = ${organization_id}` : sql``}
  `);

  logger.info(
    { count: activePeriods.length },
    'Found active bearing periods',
  );

  // For each active period, snapshot all KRs
  let snapshotCount = 0;
  const today = new Date().toISOString().split('T')[0];

  for (const period of activePeriods) {
    const krs: any[] = await db.execute(sql`
      SELECT kr.id, kr.current_value, kr.progress
      FROM bearing_key_results kr
      JOIN bearing_goals g ON kr.goal_id = g.id
      WHERE g.period_id = ${period.id}
    `);

    for (const kr of krs) {
      // Upsert snapshot — idempotent for re-runs on the same day
      await db.execute(sql`
        INSERT INTO bearing_kr_snapshots (key_result_id, snapshot_date, current_value, progress)
        VALUES (${kr.id}, ${today}, ${kr.current_value}, ${kr.progress})
        ON CONFLICT (key_result_id, snapshot_date) DO UPDATE
        SET current_value = EXCLUDED.current_value,
            progress = EXCLUDED.progress
      `);
      snapshotCount++;
    }
  }

  logger.info(
    { jobId: job.id, snapshotCount, periodsProcessed: activePeriods.length },
    'Bearing snapshot job completed',
  );
}
