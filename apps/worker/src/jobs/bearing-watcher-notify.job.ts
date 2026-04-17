/**
 * Bearing watcher notification job.
 *
 * When a goal's status changes, this job emails all watchers of that goal.
 * Uses the same nodemailer/SMTP pattern as bill-email-send.job.ts: real
 * SMTP when SMTP_HOST is configured, log-only fallback otherwise.
 *
 * Entry modes:
 *   - direct: { goal_id, old_status, new_status, changed_by_name }
 *   - (future) sweep: could scan bearing_goals for recent status changes
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { getDb } from '../utils/db.js';
import { getSmtpConfig } from '../utils/smtp-config.js';
import type { Env } from '../env.js';

export interface BearingWatcherNotifyJobData {
  goal_id: string;
  old_status: string;
  new_status: string;
  changed_by_name?: string;
}

interface WatcherRow {
  user_id: string;
  email: string;
  display_name: string | null;
}

interface GoalRow {
  id: string;
  title: string;
  organization_id: string;
  progress: string;
}

export async function processBearingWatcherNotifyJob(
  job: Job<BearingWatcherNotifyJobData>,
  env: Env,
  logger: Logger,
): Promise<void> {
  const { goal_id, old_status, new_status, changed_by_name } = job.data;

  if (!goal_id || !new_status) {
    logger.warn({ jobId: job.id }, 'bearing-watcher-notify: missing required fields, skipping');
    return;
  }

  const db = getDb();

  // 1. Load the goal
  const goalRowsRaw = await db.execute(sql`
    SELECT id, title, organization_id, progress
    FROM bearing_goals
    WHERE id = ${goal_id}
    LIMIT 1
  `);
  const goalRows = (
    Array.isArray(goalRowsRaw)
      ? goalRowsRaw
      : ((goalRowsRaw as { rows?: unknown[] }).rows ?? [])
  ) as GoalRow[];

  const goal = goalRows[0];
  if (!goal) {
    logger.warn({ goal_id }, 'bearing-watcher-notify: goal not found');
    return;
  }

  // 2. Load watchers with their email addresses
  const watcherRowsRaw = await db.execute(sql`
    SELECT w.user_id, u.email, u.display_name
    FROM bearing_goal_watchers w
    JOIN users u ON u.id = w.user_id
    WHERE w.goal_id = ${goal_id}
  `);
  const watchers = (
    Array.isArray(watcherRowsRaw)
      ? watcherRowsRaw
      : ((watcherRowsRaw as { rows?: unknown[] }).rows ?? [])
  ) as WatcherRow[];

  if (watchers.length === 0) {
    logger.debug({ goal_id }, 'bearing-watcher-notify: no watchers for goal');
    return;
  }

  // 3. Build the email
  const subject = `Goal status changed: ${goal.title}`;
  const changedBy = changed_by_name ?? 'Someone';
  const progressPct = parseFloat(goal.progress).toFixed(0);

  const body = [
    `${changedBy} updated the status of "${goal.title}".`,
    '',
    `Status: ${old_status || '(none)'} -> ${new_status}`,
    `Progress: ${progressPct}%`,
    '',
    'You are receiving this because you are watching this goal.',
  ].join('\n');

  // 4. Resolve SMTP config
  const cfg = await getSmtpConfig(db, env);
  const transport = cfg
    ? nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
      })
    : null;

  // 5. Send to each watcher
  let sent = 0;
  let skipped = 0;

  for (const watcher of watchers) {
    if (!watcher.email) {
      skipped += 1;
      continue;
    }

    try {
      if (transport && cfg) {
        await transport.sendMail({
          from: cfg.from,
          to: watcher.email,
          subject,
          text: body,
        });
        logger.info(
          { goal_id, to: watcher.email },
          'bearing-watcher-notify: email sent',
        );
      } else {
        logger.info(
          { goal_id, to: watcher.email, subject },
          'bearing-watcher-notify: SMTP not configured, logging notification',
        );
      }
      sent += 1;
    } catch (err) {
      logger.error(
        {
          goal_id,
          to: watcher.email,
          err: err instanceof Error ? err.message : String(err),
        },
        'bearing-watcher-notify: failed to send email',
      );
    }
  }

  logger.info(
    { jobId: job.id, goal_id, watchers: watchers.length, sent, skipped },
    'bearing-watcher-notify: job complete',
  );
}
