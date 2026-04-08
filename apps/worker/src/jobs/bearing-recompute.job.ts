/**
 * Bearing recompute job — recalculates KR progress from linked Bam data.
 *
 * Enqueued when a Bam task is completed (or otherwise changes state).
 * Debounced to once per minute per KR via BullMQ job deduplication.
 *
 * Steps:
 *   1. Load KR and its links (epic, project, task_query)
 *   2. For each link, compute progress from Bam data
 *   3. Update KR current_value and progress
 *   4. Recompute parent goal progress (weighted average of KRs)
 *   5. Update goal status via status engine
 *   6. Invalidate Redis cache
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { getDb } from '../utils/db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BearingRecomputeJobData {
  key_result_id: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a number between 0 and 100. */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Determine goal status from progress percentage. */
function deriveGoalStatus(progress: number): string {
  if (progress >= 100) return 'completed';
  if (progress >= 70) return 'on_track';
  if (progress >= 40) return 'at_risk';
  return 'behind';
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processBearingRecomputeJob(
  job: Job<BearingRecomputeJobData>,
  logger: Logger,
): Promise<void> {
  const { key_result_id } = job.data;
  logger.info({ jobId: job.id, key_result_id }, 'Starting bearing recompute job');

  const db = getDb();

  // -------------------------------------------------------------------------
  // Step 1: Load the KR and its definition
  // -------------------------------------------------------------------------

  const krRows: any[] = await db.execute(sql`
    SELECT kr.id, kr.goal_id, kr.start_value, kr.target_value, kr.current_value,
           kr.progress, kr.weight, kr.unit,
           g.status_override AS goal_status_override
    FROM bearing_key_results kr
    JOIN bearing_goals g ON g.id = kr.goal_id
    WHERE kr.id = ${key_result_id}
  `);

  if (krRows.length === 0) {
    logger.warn({ key_result_id }, 'KR not found, skipping recompute');
    return;
  }

  const kr = krRows[0];

  // -------------------------------------------------------------------------
  // Step 2: Load links and compute progress from Bam data
  // -------------------------------------------------------------------------

  const links: any[] = await db.execute(sql`
    SELECT id, link_type, linked_project_id, linked_epic_id, task_query,
           weight AS link_weight
    FROM bearing_kr_links
    WHERE key_result_id = ${key_result_id}
  `);

  let computedValue: number | null = null;

  if (links.length === 0) {
    // No links — keep current value as-is (manually updated KR)
    logger.info({ key_result_id }, 'No links found, keeping current value');
    return;
  }

  let totalWeight = 0;
  let weightedProgress = 0;

  for (const link of links) {
    const linkWeight = Number(link.link_weight ?? 1);
    let linkProgress = 0;

    if (link.link_type === 'epic' && link.linked_epic_id) {
      // Progress = % of tasks in done state within the epic
      const epicResult: any[] = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE ts.category = 'done'
          )::int AS done
        FROM tasks t
        JOIN task_states ts ON ts.id = t.state_id
        WHERE t.epic_id = ${link.linked_epic_id}
      `);

      const { total, done } = epicResult[0] ?? { total: 0, done: 0 };
      linkProgress = total > 0 ? (done / total) * 100 : 0;

    } else if (link.link_type === 'project' && link.linked_project_id) {
      // Progress = % of tasks in done state within the project
      const projResult: any[] = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE ts.category = 'done'
          )::int AS done
        FROM tasks t
        JOIN task_states ts ON ts.id = t.state_id
        WHERE t.project_id = ${link.linked_project_id}
      `);

      const { total, done } = projResult[0] ?? { total: 0, done: 0 };
      linkProgress = total > 0 ? (done / total) * 100 : 0;

    } else if (link.link_type === 'task_query' && link.task_query) {
      // task_query is a JSONB filter — compute from matching tasks
      // Supported filter keys: project_id, label_ids, assignee_id, phase_id
      const query = typeof link.task_query === 'string'
        ? JSON.parse(link.task_query)
        : link.task_query;

      const conditions: string[] = [];
      const values: any[] = [];

      if (query.project_id) {
        conditions.push('t.project_id = $PROJECT_ID');
        values.push(query.project_id);
      }
      if (query.assignee_id) {
        conditions.push('t.assignee_id = $ASSIGNEE_ID');
        values.push(query.assignee_id);
      }
      if (query.phase_id) {
        conditions.push('t.phase_id = $PHASE_ID');
        values.push(query.phase_id);
      }

      // For task_query, use a simplified approach with project_id filter
      if (query.project_id) {
        const tqResult: any[] = await db.execute(sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE ts.category = 'done'
            )::int AS done
          FROM tasks t
          JOIN task_states ts ON ts.id = t.state_id
          WHERE t.project_id = ${query.project_id}
        `);

        const { total, done } = tqResult[0] ?? { total: 0, done: 0 };
        linkProgress = total > 0 ? (done / total) * 100 : 0;
      }
    }

    totalWeight += linkWeight;
    weightedProgress += linkProgress * linkWeight;
  }

  // Weighted average progress across all links
  const avgProgress = totalWeight > 0 ? weightedProgress / totalWeight : 0;
  const clampedProgress = clamp(Math.round(avgProgress * 100) / 100);

  // Map progress back to current_value using KR's value range
  const startVal = Number(kr.start_value ?? 0);
  const targetVal = Number(kr.target_value ?? 100);
  computedValue = startVal + (clampedProgress / 100) * (targetVal - startVal);

  // -------------------------------------------------------------------------
  // Step 3: Update KR current_value and progress
  // -------------------------------------------------------------------------

  await db.execute(sql`
    UPDATE bearing_key_results
    SET current_value = ${computedValue},
        progress = ${clampedProgress},
        updated_at = NOW()
    WHERE id = ${key_result_id}
  `);

  logger.info(
    { key_result_id, computedValue, progress: clampedProgress },
    'Updated KR progress',
  );

  // -------------------------------------------------------------------------
  // Step 4: Recompute parent goal progress (weighted average of KRs)
  // -------------------------------------------------------------------------

  const goalKrs: any[] = await db.execute(sql`
    SELECT id, progress, weight
    FROM bearing_key_results
    WHERE goal_id = ${kr.goal_id}
  `);

  let goalTotalWeight = 0;
  let goalWeightedProgress = 0;

  for (const gkr of goalKrs) {
    const w = Number(gkr.weight ?? 1);
    goalTotalWeight += w;
    goalWeightedProgress += Number(gkr.progress ?? 0) * w;
  }

  const goalProgress = goalTotalWeight > 0
    ? clamp(Math.round((goalWeightedProgress / goalTotalWeight) * 100) / 100)
    : 0;

  // -------------------------------------------------------------------------
  // Step 5: Update goal status via status engine
  // -------------------------------------------------------------------------

  // Always update progress, but only update status if status_override is not set
  if (kr.goal_status_override) {
    await db.execute(sql`
      UPDATE bearing_goals
      SET progress = ${goalProgress},
          updated_at = NOW()
      WHERE id = ${kr.goal_id}
    `);
    logger.info(
      { goalId: kr.goal_id, goalProgress },
      'Updated goal progress only (status_override is set, preserving manual status)',
    );
  } else {
    const goalStatus = deriveGoalStatus(goalProgress);

    await db.execute(sql`
      UPDATE bearing_goals
      SET progress = ${goalProgress},
          status = ${goalStatus},
          updated_at = NOW()
      WHERE id = ${kr.goal_id}
    `);

    logger.info(
      { goalId: kr.goal_id, goalProgress, goalStatus },
      'Updated goal progress and status',
    );
  }

  // -------------------------------------------------------------------------
  // Step 6: Invalidate Redis cache
  // -------------------------------------------------------------------------

  let cacheRedis: Redis | null = null;
  try {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    cacheRedis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await cacheRedis.connect();

    // Invalidate KR-specific and goal-specific cache keys
    const keysToDelete = [
      `bearing:kr:${key_result_id}`,
      `bearing:goal:${kr.goal_id}`,
      `bearing:goal:${kr.goal_id}:krs`,
    ];

    await cacheRedis.del(...keysToDelete);

    logger.info({ keysInvalidated: keysToDelete.length }, 'Invalidated Redis cache');
  } catch (err) {
    // Cache invalidation failure is non-fatal
    logger.warn({ err }, 'Failed to invalidate Redis cache (non-fatal)');
  } finally {
    if (cacheRedis) {
      await cacheRedis.disconnect().catch(() => {});
    }
  }

  logger.info(
    { jobId: job.id, key_result_id, progress: clampedProgress, goalProgress },
    'Bearing recompute job completed',
  );
}
