import { eq, sql, avg } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bearingKeyResults, bearingPeriods } from '../db/schema/index.js';
import { computeAutoStatus } from './status-engine.js';
import type Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Progress computation engine
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Compute progress for a single key result based on its progress_mode.
 */
export function computeKrProgress(kr: {
  start_value: string;
  current_value: string;
  target_value: string;
  direction: string;
  progress_mode: string;
}): number {
  if (kr.progress_mode === 'linked') {
    // Linked progress is computed via computeLinkedProgress
    return 0;
  }

  const start = parseFloat(kr.start_value);
  const current = parseFloat(kr.current_value);
  const target = parseFloat(kr.target_value);

  if (kr.direction === 'decrease') {
    // For decrease direction: progress when current goes down from start toward target
    const range = start - target;
    if (range <= 0) return 100;
    const moved = start - current;
    return Math.min(100, Math.max(0, (moved / range) * 100));
  }

  // Default: increase direction
  const range = target - start;
  if (range <= 0) return 100;
  const moved = current - start;
  return Math.min(100, Math.max(0, (moved / range) * 100));
}

/**
 * Compute linked progress by querying Bam tasks/epics via direct DB access.
 * This queries task completion stats for linked items.
 */
export async function computeLinkedProgress(kr: {
  id: string;
  linked_query: unknown;
}): Promise<number> {
  if (!kr.linked_query) return 0;

  const query = kr.linked_query as Record<string, unknown>;
  const targetType = query.target_type as string | undefined;

  if (targetType === 'task' || targetType === 'tasks') {
    // Query tasks linked to this KR via bearing_kr_links
    const result: any[] = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE t.status = 'done')::int AS completed
      FROM bearing_kr_links l
      JOIN tasks t ON t.id = l.target_id
      WHERE l.key_result_id = ${kr.id}
        AND l.target_type = 'task'
    `);

    const row = result[0];
    if (!row || row.total === 0) return 0;
    return (row.completed / row.total) * 100;
  }

  return 0;
}

/**
 * Compute aggregate goal progress from its key results.
 * Returns the average of all KR progress values.
 */
export async function computeGoalProgress(goalId: string): Promise<number> {
  const result = await db
    .select({
      avg_progress: avg(bearingKeyResults.progress),
    })
    .from(bearingKeyResults)
    .where(eq(bearingKeyResults.goal_id, goalId));

  const row = result[0];
  if (!row || row.avg_progress === null) return 0;
  return parseFloat(row.avg_progress);
}

/**
 * Compute goal status based on progress vs elapsed time in the period.
 * Returns auto-status unless status_override is set.
 */
export async function computeGoalStatus(
  goal: {
    id: string;
    period_id: string;
    progress: string;
    status_override: boolean;
    status: string;
  },
): Promise<string> {
  if (goal.status_override) return goal.status;

  const [period] = await db
    .select()
    .from(bearingPeriods)
    .where(eq(bearingPeriods.id, goal.period_id))
    .limit(1);

  if (!period) return goal.status;

  return computeAutoStatus({
    progress: parseFloat(goal.progress),
    starts_at: period.starts_at,
    ends_at: period.ends_at,
  });
}

/**
 * Get cached progress or compute and cache it.
 */
export async function getCachedGoalProgress(
  goalId: string,
  redis: Redis,
): Promise<number> {
  const cacheKey = `bearing:goal:progress:${goalId}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return parseFloat(cached);

  const progress = await computeGoalProgress(goalId);
  await redis.set(cacheKey, progress.toString(), 'EX', CACHE_TTL_SECONDS);
  return progress;
}

/**
 * Invalidate cached progress for a goal.
 */
export async function invalidateGoalProgressCache(
  goalId: string,
  redis: Redis,
): Promise<void> {
  await redis.del(`bearing:goal:progress:${goalId}`);
}
