/**
 * Bolt schedule tick job, once-a-minute cron driver (G2, Wave 2 P0).
 *
 * Registered as a BullMQ repeating job in `worker.ts` with the `* * * * *`
 * pattern. Each tick scans `bolt_schedules` for due rows and fires synthetic
 * `cron.fired` events to Bolt ingest via `processBoltScheduleTick`. The entire
 * scheduler logic lives in `services/bolt-scheduler.service.ts` so this file
 * stays a thin BullMQ adapter.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { processBoltScheduleTick } from '../services/bolt-scheduler.service.js';

export interface BoltScheduleTickJobData {
  // Reserved for future use (e.g. org scoping for targeted runs). Intentionally
  // empty today so the repeating job carries the smallest possible payload.
  organization_id?: string;
}

export async function processBoltScheduleTickJob(
  job: Job<BoltScheduleTickJobData>,
  logger: Logger,
): Promise<void> {
  logger.info({ jobId: job.id }, 'Bolt schedule tick: starting');
  const result = await processBoltScheduleTick(logger);
  logger.info(
    {
      jobId: job.id,
      scanned: result.scanned,
      fired: result.fired,
      skipped: result.skipped,
      errors: result.errors,
    },
    'Bolt schedule tick: done',
  );
}
