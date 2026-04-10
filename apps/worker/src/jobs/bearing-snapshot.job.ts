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
      // Idempotent snapshot insert for the current day.
      // The Drizzle schema uses `value` and `recorded_at` (not the
      // original design-doc names `current_value` / `snapshot_date`).
      // Delete any existing snapshot for this KR + day, then insert fresh.
      await db.execute(sql`
        DELETE FROM bearing_kr_snapshots
        WHERE key_result_id = ${kr.id}
          AND recorded_at::date = ${today}::date
      `);
      await db.execute(sql`
        INSERT INTO bearing_kr_snapshots (key_result_id, value, progress, recorded_at)
        VALUES (${kr.id}, ${kr.current_value}, ${kr.progress}, ${today}::timestamptz)
      `);
      snapshotCount++;
    }
  }

  logger.info(
    { jobId: job.id, snapshotCount, periodsProcessed: activePeriods.length },
    'Bearing snapshot job completed',
  );
}
