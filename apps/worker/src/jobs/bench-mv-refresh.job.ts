/**
 * Bench materialized-view refresh scheduler (Bench_Plan.md G3).
 *
 * Runs on a short cadence (wired to every 5 minutes in worker.ts). On
 * each tick it finds `bench_materialized_views` rows whose
 * `next_scheduled_at <= NOW()` (or NULL, for first-run rows), then for
 * each one issues a `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
 *
 * Concurrent refresh requires a unique index on the MV. If the
 * concurrent path errors we retry once without CONCURRENTLY so a single
 * misconfigured MV does not block the rest of the sweep.
 *
 * Rows track their own scheduling via `next_scheduled_at`, which we
 * bump on every attempt by a simple fixed interval derived from the
 * `refresh_cron` column when possible, defaulting to 5 minutes.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

export interface BenchMvRefreshJobData {
  /** Optional: refresh a specific view by name. */
  view_name?: string;
  /** Sweep cap. Defaults to 25 MVs per tick. */
  limit?: number;
}

interface MvRow {
  id: string;
  view_name: string;
  refresh_cron: string;
}

/**
 * Very small helper that turns a subset of common cron expressions into a
 * millisecond interval for the `next_scheduled_at` bump. We only recognise
 * the shapes we actually use in the seed data; anything else falls back
 * to 5 minutes, which is the schema default.
 */
function intervalMsFromCron(cron: string): number {
  const trimmed = cron.trim();
  const match = /^\*\/(\d+) \* \* \* \*$/.exec(trimmed);
  if (match && match[1]) {
    const mins = parseInt(match[1], 10);
    if (Number.isFinite(mins) && mins > 0) return mins * 60_000;
  }
  if (trimmed === '0 * * * *') return 60 * 60_000;
  if (trimmed === '0 0 * * *') return 24 * 60 * 60_000;
  return 5 * 60_000;
}

async function fetchDueViews(limit: number): Promise<MvRow[]> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT id, view_name, refresh_cron
    FROM bench_materialized_views
    WHERE next_scheduled_at IS NULL OR next_scheduled_at <= NOW()
    ORDER BY next_scheduled_at NULLS FIRST
    LIMIT ${limit}
  `);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? []);
  return rows as MvRow[];
}

async function fetchOneView(viewName: string): Promise<MvRow | null> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT id, view_name, refresh_cron
    FROM bench_materialized_views
    WHERE view_name = ${viewName}
    LIMIT 1
  `);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? []);
  return (rows[0] as MvRow) ?? null;
}

async function refreshView(row: MvRow, logger: Logger): Promise<'success' | 'failed'> {
  const db = getDb();
  const startedAt = Date.now();
  const identifier = sql.raw(`"${row.view_name.replace(/"/g, '""')}"`);
  let attemptedFallback = false;

  try {
    try {
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY ${identifier}`);
    } catch (concurrentErr) {
      attemptedFallback = true;
      const message =
        concurrentErr instanceof Error ? concurrentErr.message : String(concurrentErr);
      logger.warn(
        { viewName: row.view_name, err: message },
        'bench-mv-refresh: CONCURRENTLY failed, falling back to plain REFRESH',
      );
      await db.execute(sql`REFRESH MATERIALIZED VIEW ${identifier}`);
    }

    const durationMs = Date.now() - startedAt;
    const nextMs = intervalMsFromCron(row.refresh_cron);

    await db.execute(sql`
      UPDATE bench_materialized_views
      SET
        last_refreshed_at = NOW(),
        last_refresh_attempt_at = NOW(),
        last_refresh_status = 'success',
        last_refresh_error = NULL,
        refresh_duration_ms = ${durationMs},
        next_scheduled_at = NOW() + (${nextMs}::bigint || ' milliseconds')::interval
      WHERE id = ${row.id}
    `);

    logger.info(
      { viewName: row.view_name, durationMs, fallback: attemptedFallback },
      'bench-mv-refresh: refreshed',
    );
    return 'success';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;
    const nextMs = intervalMsFromCron(row.refresh_cron);
    await db.execute(sql`
      UPDATE bench_materialized_views
      SET
        last_refresh_attempt_at = NOW(),
        last_refresh_status = 'failed',
        last_refresh_error = ${message.slice(0, 500)},
        refresh_duration_ms = ${durationMs},
        next_scheduled_at = NOW() + (${nextMs}::bigint || ' milliseconds')::interval
      WHERE id = ${row.id}
    `);
    logger.error(
      { viewName: row.view_name, err: message },
      'bench-mv-refresh: refresh failed',
    );
    return 'failed';
  }
}

export async function processBenchMvRefreshJob(
  job: Job<BenchMvRefreshJobData>,
  logger: Logger,
): Promise<void> {
  const { view_name, limit } = job.data ?? {};

  if (view_name) {
    const row = await fetchOneView(view_name);
    if (!row) {
      logger.warn({ viewName: view_name }, 'bench-mv-refresh: view not found');
      return;
    }
    await refreshView(row, logger);
    return;
  }

  const cap = limit ?? 25;
  const rows = await fetchDueViews(cap);
  if (rows.length === 0) {
    logger.debug('bench-mv-refresh: no due views');
    return;
  }

  logger.info({ jobId: job.id, candidates: rows.length }, 'bench-mv-refresh: sweep start');

  let success = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const outcome = await refreshView(row, logger);
      if (outcome === 'success') success += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      logger.error(
        { viewName: row.view_name, err: err instanceof Error ? err.message : String(err) },
        'bench-mv-refresh: unexpected error',
      );
    }
  }

  logger.info(
    { jobId: job.id, candidates: rows.length, success, failed },
    'bench-mv-refresh: sweep complete',
  );
}
