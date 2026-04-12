/**
 * Bearing digest job — generates and caches a weekly goals summary.
 *
 * Produces a markdown summary of all goals within an org's active periods:
 * goals grouped by status, progress percentages, at-risk items highlighted.
 * Cached in Redis with a 24h TTL for fast retrieval by the API.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { getDb } from '../utils/db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BearingDigestJobData {
  organization_id: string;
  /** Optional: scope to a specific period (defaults to all active periods) */
  period_id?: string;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processBearingDigestJob(
  job: Job<BearingDigestJobData>,
  logger: Logger,
): Promise<void> {
  const { organization_id, period_id } = job.data;
  logger.info({ jobId: job.id, organization_id, period_id }, 'Starting bearing digest job');

  const db = getDb();

  // -------------------------------------------------------------------------
  // Load active periods
  // -------------------------------------------------------------------------

  const periods: any[] = await db.execute(sql`
    SELECT id, name, start_date, end_date
    FROM bearing_periods
    WHERE organization_id = ${organization_id}
      AND status = 'active'
      ${period_id ? sql`AND id = ${period_id}` : sql``}
    ORDER BY start_date ASC
  `);

  if (periods.length === 0) {
    logger.info({ organization_id }, 'No active periods found, skipping digest');
    return;
  }

  // -------------------------------------------------------------------------
  // Build markdown digest for each period
  // -------------------------------------------------------------------------

  const digestParts: string[] = [];
  const generatedAt = new Date().toISOString();

  for (const period of periods) {
    const goals: any[] = await db.execute(sql`
      SELECT g.id, g.title, g.status, g.progress, g.owner_id,
             u.name AS owner_name
      FROM bearing_goals g
      LEFT JOIN users u ON u.id = g.owner_id
      WHERE g.period_id = ${period.id}
      ORDER BY g.sort_order ASC, g.title ASC
    `);

    if (goals.length === 0) continue;

    // Group goals by status
    const byStatus: Record<string, any[]> = {};
    for (const goal of goals) {
      const status = goal.status ?? 'unknown';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(goal);
    }

    // Compute period-level stats
    const totalGoals = goals.length;
    const avgProgress = goals.reduce((sum: number, g: any) => sum + Number(g.progress ?? 0), 0) / totalGoals;
    const completedCount = (byStatus['completed'] ?? []).length;
    const atRiskCount = (byStatus['at_risk'] ?? []).length;
    const behindCount = (byStatus['behind'] ?? []).length;

    // Build markdown section
    const lines: string[] = [];
    lines.push(`## ${period.name}`);
    lines.push('');
    lines.push(`**Period:** ${period.start_date} to ${period.end_date}`);
    lines.push(`**Goals:** ${totalGoals} | **Avg Progress:** ${avgProgress.toFixed(1)}% | **Completed:** ${completedCount} | **At Risk:** ${atRiskCount} | **Behind:** ${behindCount}`);
    lines.push('');

    // At-risk and behind items first (highlighted)
    const flagged = [...(byStatus['behind'] ?? []), ...(byStatus['at_risk'] ?? [])];
    if (flagged.length > 0) {
      lines.push('### Needs Attention');
      lines.push('');
      for (const goal of flagged) {
        const statusEmoji = goal.status === 'behind' ? 'BEHIND' : 'AT RISK';
        const owner = goal.owner_name ?? 'Unassigned';
        lines.push(`- **[${statusEmoji}]** ${goal.title} — ${Number(goal.progress ?? 0).toFixed(1)}% (Owner: ${owner})`);
      }
      lines.push('');
    }

    // All goals by status
    const statusOrder = ['on_track', 'completed', 'at_risk', 'behind', 'unknown'];
    const statusLabels: Record<string, string> = {
      on_track: 'On Track',
      completed: 'Completed',
      at_risk: 'At Risk',
      behind: 'Behind',
      unknown: 'No Status',
    };

    lines.push('### All Goals');
    lines.push('');
    lines.push('| Goal | Owner | Progress | Status |');
    lines.push('|------|-------|----------|--------|');

    for (const status of statusOrder) {
      for (const goal of byStatus[status] ?? []) {
        const owner = goal.owner_name ?? 'Unassigned';
        const progress = Number(goal.progress ?? 0).toFixed(1);
        lines.push(`| ${goal.title} | ${owner} | ${progress}% | ${statusLabels[status] ?? status} |`);
      }
    }

    lines.push('');

    // Load KR details for at-risk / behind goals
    if (flagged.length > 0) {
      lines.push('### Key Result Details (Flagged Goals)');
      lines.push('');

      for (const goal of flagged) {
        const krs: any[] = await db.execute(sql`
          SELECT title, current_value, target_value, start_value, progress, unit
          FROM bearing_key_results
          WHERE goal_id = ${goal.id}
          ORDER BY sort_order ASC
        `);

        if (krs.length > 0) {
          lines.push(`**${goal.title}:**`);
          for (const kr of krs) {
            const unit = kr.unit ?? '';
            const current = Number(kr.current_value ?? 0);
            const target = Number(kr.target_value ?? 100);
            const progress = Number(kr.progress ?? 0).toFixed(1);
            lines.push(`  - ${kr.title}: ${current}${unit} / ${target}${unit} (${progress}%)`);
          }
          lines.push('');
        }
      }
    }

    digestParts.push(lines.join('\n'));
  }

  // -------------------------------------------------------------------------
  // Assemble final digest
  // -------------------------------------------------------------------------

  const header = [
    '# Bearing Goals Digest',
    '',
    `**Organization:** ${organization_id}`,
    `**Generated:** ${generatedAt}`,
    '',
    '---',
    '',
  ].join('\n');

  const digest = header + digestParts.join('\n---\n\n');

  // -------------------------------------------------------------------------
  // Cache in Redis with 24h TTL
  // -------------------------------------------------------------------------

  let cacheRedis: Redis | null = null;
  try {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    cacheRedis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await cacheRedis.connect();

    for (const period of periods) {
      const cacheKey = `bearing:digest:${organization_id}:${period.id}`;
      await cacheRedis.set(cacheKey, digest, 'EX', 86400); // 24h TTL
    }

    // Also cache an org-level digest key
    const orgKey = `bearing:digest:${organization_id}:latest`;
    await cacheRedis.set(orgKey, digest, 'EX', 86400);

    logger.info(
      { periodsCount: periods.length },
      'Cached bearing digest in Redis (24h TTL)',
    );
  } catch (err) {
    logger.warn({ err }, 'Failed to cache digest in Redis (non-fatal)');
  } finally {
    if (cacheRedis) {
      await cacheRedis.quit().catch(() => {});
    }
  }

  logger.info(
    { jobId: job.id, organization_id, periodsProcessed: periods.length, digestLength: digest.length },
    'Bearing digest job completed',
  );
}
