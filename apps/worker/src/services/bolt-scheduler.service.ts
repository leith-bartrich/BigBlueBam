/**
 * Bolt scheduler service — G2 cron driver (Wave 2 P0).
 *
 * Queries `bolt_schedules` for due rows, emits synthetic `cron.fired` events to
 * the Bolt API `/v1/events/ingest` endpoint (fire-and-forget via the shared
 * `publishBoltEvent` helper), and advances `next_run_at` using a minimal
 * built-in cron parser.
 *
 * Cron parser scope:
 *   - Standard 5-field cron: minute hour dom month dow
 *   - Supports `*`, numeric values, lists (`1,2,3`), ranges (`1-5`), and
 *     step values (`* / 5`, `0-30/10`).
 *   - Intentionally NOT supported (deferred): named months/weekdays ("MON"),
 *     special strings ("@daily"), L/W/#, and 6-field (seconds) cron. Any
 *     unparseable expression falls back to "one hour from now" so schedules
 *     never get wedged on the past. Deferred in favor of shipping G2 without
 *     adding cron-parser to the monorepo.
 *
 * Timezone scope:
 *   - Everything computes in UTC. `cron_timezone` on the automation row is
 *     recorded but not currently honored. Orgs that need non-UTC scheduling
 *     should track this as a follow-up task.
 *
 * Entry points:
 *   - `processBoltScheduleTick(logger)` is called once per BullMQ tick
 *     (every minute) from `bolt-schedule-tick.job.ts`.
 */

import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';
import { publishBoltEvent } from '../utils/bolt-events.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DueSchedule {
  schedule_id: string;
  automation_id: string;
  org_id: string;
  cron_expression: string | null;
  cron_timezone: string;
  next_run_at: Date | null;
}

export interface SchedulerTickResult {
  scanned: number;
  fired: number;
  skipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Minimal cron parser (5 fields)
// ---------------------------------------------------------------------------

interface CronFields {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>; // 1-12
  dow: Set<number>; // 0-6, Sunday = 0
}

function parseField(raw: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of raw.split(',')) {
    let piece = part.trim();
    if (!piece) continue;

    // Step: base/step
    let step = 1;
    const slashIdx = piece.indexOf('/');
    if (slashIdx >= 0) {
      const stepStr = piece.slice(slashIdx + 1);
      piece = piece.slice(0, slashIdx);
      step = Number.parseInt(stepStr, 10);
      if (!Number.isFinite(step) || step <= 0) {
        throw new Error(`Invalid step value in cron field: ${raw}`);
      }
    }

    let lo: number;
    let hi: number;
    if (piece === '*') {
      lo = min;
      hi = max;
    } else if (piece.includes('-')) {
      const [loStr, hiStr] = piece.split('-');
      lo = Number.parseInt(loStr ?? '', 10);
      hi = Number.parseInt(hiStr ?? '', 10);
    } else {
      lo = Number.parseInt(piece, 10);
      hi = lo;
    }

    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < min || hi > max || lo > hi) {
      throw new Error(`Out-of-range cron field: ${raw}`);
    }

    for (let v = lo; v <= hi; v += step) {
      out.add(v);
    }
  }
  if (out.size === 0) {
    throw new Error(`Empty cron field: ${raw}`);
  }
  return out;
}

function parseCron(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Cron expression must have 5 fields, got ${parts.length}: ${expr}`);
  }
  return {
    minute: parseField(parts[0]!, 0, 59),
    hour: parseField(parts[1]!, 0, 23),
    dom: parseField(parts[2]!, 1, 31),
    month: parseField(parts[3]!, 1, 12),
    dow: parseField(parts[4]!, 0, 6),
  };
}

/**
 * Compute the next firing time AFTER `from` (strictly greater), in UTC.
 * Walks forward one minute at a time up to 366 days. Deliberately simple; for
 * tick cadence every minute this is cheap enough (worst case is ~500k scans
 * for a once-a-year schedule, still sub-millisecond in V8).
 */
function computeNextRun(expr: string, from: Date): Date {
  const fields = parseCron(expr);
  // Round up to next whole minute
  const candidate = new Date(from.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  const maxMinutes = 366 * 24 * 60;
  for (let i = 0; i < maxMinutes; i++) {
    const minute = candidate.getUTCMinutes();
    const hour = candidate.getUTCHours();
    const dom = candidate.getUTCDate();
    const month = candidate.getUTCMonth() + 1;
    const dow = candidate.getUTCDay();

    if (
      fields.minute.has(minute) &&
      fields.hour.has(hour) &&
      fields.dom.has(dom) &&
      fields.month.has(month) &&
      fields.dow.has(dow)
    ) {
      return candidate;
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error(`No next cron firing found within 366 days for: ${expr}`);
}

/**
 * Fallback for unparseable cron expressions — one hour in the future from
 * `from`. Keeps the row moving forward so the rest of the schedule loop stays
 * healthy even if a single automation has a malformed cron.
 */
function fallbackNextRun(from: Date): Date {
  return new Date(from.getTime() + 60 * 60 * 1000);
}

// Exported for testability / future callers.
export function nextRunAfter(cronExpression: string, from: Date): Date {
  try {
    return computeNextRun(cronExpression, from);
  } catch {
    return fallbackNextRun(from);
  }
}

// ---------------------------------------------------------------------------
// Main tick
// ---------------------------------------------------------------------------

export async function processBoltScheduleTick(logger: Logger): Promise<SchedulerTickResult> {
  const db = getDb();
  const now = new Date();

  const rowsRaw = await db.execute(sql`
    SELECT
      s.id               AS schedule_id,
      s.automation_id    AS automation_id,
      s.next_run_at      AS next_run_at,
      a.org_id           AS org_id,
      a.cron_expression  AS cron_expression,
      a.cron_timezone    AS cron_timezone
    FROM bolt_schedules s
    INNER JOIN bolt_automations a ON a.id = s.automation_id
    WHERE a.enabled = TRUE
      AND a.trigger_source = 'schedule'
      AND a.trigger_event = 'cron.fired'
      AND s.next_run_at IS NOT NULL
      AND s.next_run_at <= NOW()
    ORDER BY s.next_run_at ASC
    LIMIT 500
  `);

  const rows: DueSchedule[] = (
    Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? [])
  ) as DueSchedule[];

  if (rows.length === 0) {
    return { scanned: 0, fired: 0, skipped: 0, errors: 0 };
  }

  logger.info({ due: rows.length }, 'Bolt scheduler: due schedules found');

  let fired = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      if (!row.cron_expression) {
        // Automation is wired to schedule but has no cron expression — null
        // out next_run_at so we stop re-processing this row every tick.
        await db.execute(sql`
          UPDATE bolt_schedules
          SET next_run_at = NULL
          WHERE id = ${row.schedule_id}
        `);
        skipped += 1;
        continue;
      }

      // Fire-and-forget synthetic cron.fired event. publishBoltEvent swallows
      // errors so Bolt ingest being momentarily unreachable does not kill the
      // tick. The automation-side routing/condition layer takes it from here.
      await publishBoltEvent(
        'cron.fired',
        'schedule',
        {
          schedule_id: row.schedule_id,
          automation_id: row.automation_id,
          fired_at: now.toISOString(),
          cron_expression: row.cron_expression,
          cron_timezone: row.cron_timezone,
        },
        row.org_id,
        undefined,
        'system',
      );

      const nextRun = nextRunAfter(row.cron_expression, now);

      await db.execute(sql`
        UPDATE bolt_schedules
        SET last_run_at = NOW(),
            next_run_at = ${nextRun}
        WHERE id = ${row.schedule_id}
      `);

      fired += 1;
    } catch (err) {
      errors += 1;
      logger.error(
        {
          schedule_id: row.schedule_id,
          automation_id: row.automation_id,
          err: err instanceof Error ? err.message : String(err),
        },
        'Bolt scheduler: failed to process due schedule',
      );
    }
  }

  logger.info(
    { scanned: rows.length, fired, skipped, errors },
    'Bolt scheduler tick complete',
  );

  return { scanned: rows.length, fired, skipped, errors };
}
