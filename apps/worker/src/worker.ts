import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import { loadEnv } from './env.js';
import { createDb, closeDb } from './utils/db.js';
import { processEmailJob, type EmailJobData } from './jobs/email.job.js';
import { processNotificationJob, type NotificationJobData } from './jobs/notification.job.js';
import { processSprintCloseJob, type SprintCloseJobData } from './jobs/sprint-close.job.js';
import { processExportJob, type ExportJobData } from './jobs/export.job.js';
import { processBanterNotificationJob, type BanterNotificationJobData } from './jobs/banter-notification.job.js';
import { processBanterRetentionJob, type BanterRetentionJobData } from './jobs/banter-retention.job.js';
import { processHelpdeskTaskCreateJob, type HelpdeskTaskCreateJobData } from './jobs/helpdesk-task-create.job.js';
import { processBeaconVectorSyncJob, type BeaconVectorSyncJobData } from './jobs/beacon-vector-sync.job.js';
import { processBeaconExpirySweepJob, type BeaconExpirySweepJobData } from './jobs/beacon-expiry-sweep.job.js';
import { processBearingSnapshotJob, type BearingSnapshotJobData } from './jobs/bearing-snapshot.job.js';
import { processBearingRecomputeJob, type BearingRecomputeJobData } from './jobs/bearing-recompute.job.js';
import { processBearingDigestJob, type BearingDigestJobData } from './jobs/bearing-digest.job.js';
import { processBoltExecuteJob, type BoltExecuteJobData } from './jobs/bolt-execute.job.js';
import {
  processBoltScheduleTickJob,
  type BoltScheduleTickJobData,
} from './jobs/bolt-schedule-tick.job.js';
import { processBlastSendJob, type BlastSendJobData } from './jobs/blast-send.job.js';
import { processBondStaleDealsJob, type BondStaleDealsJobData } from './jobs/bond-stale-deals.job.js';
import {
  processBillPdfGenerateJob,
  type BillPdfGenerateJobData,
} from './jobs/bill-pdf-generate.job.js';
import {
  processBillEmailSendJob,
  type BillEmailSendJobData,
} from './jobs/bill-email-send.job.js';
import {
  processBillOverdueReminderJob,
  type BillOverdueReminderJobData,
} from './jobs/bill-overdue-reminder.job.js';
import {
  processBlankConfirmationEmailJob,
  type BlankConfirmationEmailJobData,
} from './jobs/blank-confirmation-email.job.js';
import {
  processBlankFileProcessJob,
  type BlankFileProcessJobData,
} from './jobs/blank-file-process.job.js';
import {
  processBenchReportDeliverJob,
  type BenchReportDeliverJobData,
} from './jobs/bench-report-deliver.job.js';
import {
  processBenchMvRefreshJob,
  type BenchMvRefreshJobData,
} from './jobs/bench-mv-refresh.job.js';
import { processBriefEmbedJob, type BriefEmbedJobData } from './jobs/brief-embed.job.js';
import {
  processHelpdeskSlaMonitorJob,
  type HelpdeskSlaMonitorJobData,
} from './jobs/helpdesk-sla-monitor.job.js';

const env = loadEnv();

const logger = pino({
  level: env.LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

logger.info({ concurrency: env.WORKER_CONCURRENCY }, 'Starting BigBlueBam worker');

// Connect to Redis
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

redis.on('connect', () => logger.info('Connected to Redis'));
redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));

// Connect to Postgres via Drizzle
createDb(env.DATABASE_URL);
logger.info('Connected to Postgres');

// BullMQ connection options
const connection = { connection: redis };

// Email worker
const emailWorker = new Worker<EmailJobData>(
  'email',
  async (job: Job<EmailJobData>) => {
    await processEmailJob(job, env, logger);
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);

emailWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'email' }, 'Job completed');
});

emailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'email', err }, 'Job failed');
});

// Notifications worker
const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  async (job: Job<NotificationJobData>) => {
    await processNotificationJob(job, logger);
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);

notificationWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'notifications' }, 'Job completed');
});

notificationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'notifications', err }, 'Job failed');
});

// Sprint close worker
const sprintCloseWorker = new Worker<SprintCloseJobData>(
  'sprint-close',
  async (job: Job<SprintCloseJobData>) => {
    await processSprintCloseJob(job, logger);
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);

sprintCloseWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'sprint-close' }, 'Job completed');
});

sprintCloseWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'sprint-close', err }, 'Job failed');
});

// Export worker
const exportWorker = new Worker<ExportJobData>(
  'export',
  async (job: Job<ExportJobData>) => {
    await processExportJob(job, logger);
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);

exportWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'export' }, 'Job completed');
});

exportWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'export', err }, 'Job failed');
});

// Banter notification worker
const banterNotificationWorker = new Worker<BanterNotificationJobData>(
  'banter-notifications',
  async (job: Job<BanterNotificationJobData>) => {
    await processBanterNotificationJob(job, logger);
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);

banterNotificationWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'banter-notifications' }, 'Job completed');
});

banterNotificationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'banter-notifications', err }, 'Job failed');
});

// Banter data retention worker
const banterRetentionWorker = new Worker<BanterRetentionJobData>(
  'banter-retention',
  async (job: Job<BanterRetentionJobData>) => {
    await processBanterRetentionJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);

banterRetentionWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'banter-retention' }, 'Job completed');
});

banterRetentionWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'banter-retention', err }, 'Job failed');
});

// Helpdesk task-create worker (HB-23 — async fallback for ticket→task creation)
const helpdeskTaskCreateWorker = new Worker<HelpdeskTaskCreateJobData>(
  'helpdesk-task-create',
  async (job: Job<HelpdeskTaskCreateJobData>) => {
    await processHelpdeskTaskCreateJob(job, logger);
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);

helpdeskTaskCreateWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'helpdesk-task-create' }, 'Job completed');
});

helpdeskTaskCreateWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'helpdesk-task-create', err }, 'Job failed');
});

// Beacon vector sync worker
const beaconVectorSyncWorker = new Worker<BeaconVectorSyncJobData>(
  'beacon-vector-sync',
  async (job: Job<BeaconVectorSyncJobData>) => {
    await processBeaconVectorSyncJob(job, logger);
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);

beaconVectorSyncWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'beacon-vector-sync' }, 'Job completed');
});

beaconVectorSyncWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'beacon-vector-sync', err }, 'Job failed');
});

// Beacon expiry sweep worker (Fridge Cleanout §6.1 — daily cron)
const beaconExpirySweepWorker = new Worker<BeaconExpirySweepJobData>(
  'beacon-expiry-sweep',
  async (job: Job<BeaconExpirySweepJobData>) => {
    await processBeaconExpirySweepJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);

beaconExpirySweepWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'beacon-expiry-sweep' }, 'Job completed');
});

beaconExpirySweepWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'beacon-expiry-sweep', err }, 'Job failed');
});

// Schedule the expiry sweep as a daily repeatable job
import { Queue } from 'bullmq';
const beaconExpirySweepQueue = new Queue('beacon-expiry-sweep', { connection: redis });
beaconExpirySweepQueue.upsertJobScheduler(
  'beacon-expiry-sweep-daily',
  { pattern: '0 3 * * *' }, // 3 AM daily
  { name: 'daily-sweep', data: {} },
).catch((err) => logger.error({ err }, 'Failed to register beacon expiry sweep scheduler'));

// Schedule bearing snapshot as a daily repeatable job (midnight UTC)
const bearingSnapshotQueue = new Queue('bearing-snapshot', { connection: redis });
bearingSnapshotQueue.upsertJobScheduler(
  'bearing-snapshot-daily',
  { pattern: '0 0 * * *' }, // midnight UTC
  { name: 'daily-snapshot', data: {} },
).catch((err) => logger.error({ err }, 'Failed to register bearing snapshot scheduler'));

// Bearing snapshot worker (daily KR progress snapshots)
const bearingSnapshotWorker = new Worker<BearingSnapshotJobData>(
  'bearing-snapshot',
  async (job: Job<BearingSnapshotJobData>) => {
    await processBearingSnapshotJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);

bearingSnapshotWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bearing-snapshot' }, 'Job completed');
});

bearingSnapshotWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bearing-snapshot', err }, 'Job failed');
});

// Bearing recompute worker (recalculates KR progress from Bam data)
const bearingRecomputeWorker = new Worker<BearingRecomputeJobData>(
  'bearing-recompute',
  async (job: Job<BearingRecomputeJobData>) => {
    await processBearingRecomputeJob(job, logger);
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);

bearingRecomputeWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bearing-recompute' }, 'Job completed');
});

bearingRecomputeWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bearing-recompute', err }, 'Job failed');
});

// Bearing digest worker (weekly goals summary)
const bearingDigestWorker = new Worker<BearingDigestJobData>(
  'bearing-digest',
  async (job: Job<BearingDigestJobData>) => {
    await processBearingDigestJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);

bearingDigestWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bearing-digest' }, 'Job completed');
});

bearingDigestWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bearing-digest', err }, 'Job failed');
});

// Bolt execution worker (runs automation action sequences via MCP tool calls)
const boltExecuteWorker = new Worker<BoltExecuteJobData>(
  'bolt-execute',
  async (job: Job<BoltExecuteJobData>) => {
    await processBoltExecuteJob(job, logger);
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);

boltExecuteWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bolt-execute' }, 'Job completed');
});

boltExecuteWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bolt-execute', err }, 'Job failed');
});

// Bolt schedule tick worker (G2 — scans bolt_schedules every minute and fires
// synthetic cron.fired events for due rows)
const boltScheduleTickWorker = new Worker<BoltScheduleTickJobData>(
  'bolt-schedule',
  async (job: Job<BoltScheduleTickJobData>) => {
    await processBoltScheduleTickJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);

boltScheduleTickWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bolt-schedule' }, 'Job completed');
});

boltScheduleTickWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bolt-schedule', err }, 'Job failed');
});

// Schedule bolt schedule-tick as a once-a-minute repeating job
const boltScheduleQueue = new Queue('bolt-schedule', { connection: redis });
boltScheduleQueue.upsertJobScheduler(
  'bolt-schedule-tick',
  { pattern: '* * * * *' }, // every minute
  { name: 'tick', data: {} },
).catch((err) => logger.error({ err }, 'Failed to register bolt schedule tick scheduler'));

// Blast send worker (processes campaign email delivery)
const blastSendWorker = new Worker<BlastSendJobData>(
  'blast-send',
  async (job: Job<BlastSendJobData>) => {
    await processBlastSendJob(job, env, logger);
  },
  { ...connection, concurrency: 1 }, // serialize campaign sends to respect SMTP rate limits
);

blastSendWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'blast-send' }, 'Job completed');
});

blastSendWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'blast-send', err }, 'Job failed');
});

// Bond stale-deals worker (daily cron — detects rotting deals and emits bolt events)
const bondStaleDealsWorker = new Worker<BondStaleDealsJobData>(
  'bond-stale-deals',
  async (job: Job<BondStaleDealsJobData>) => {
    await processBondStaleDealsJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);

bondStaleDealsWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bond-stale-deals' }, 'Job completed');
});

bondStaleDealsWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bond-stale-deals', err }, 'Job failed');
});

// Schedule bond stale-deals sweep as a daily repeatable job at 02:00 UTC
// (offset from beacon-expiry-sweep @ 03:00 and bearing-snapshot @ 00:00)
const bondStaleDealsQueue = new Queue('bond-stale-deals', { connection: redis });
bondStaleDealsQueue.upsertJobScheduler(
  'bond-stale-deals-daily',
  { pattern: '0 2 * * *' }, // 2 AM daily
  { name: 'daily-sweep', data: {} },
).catch((err) => logger.error({ err }, 'Failed to register bond stale-deals scheduler'));

// ---------------------------------------------------------------------------
// Wave 2C deferred workers (Bill, Blank, Bench, Brief, Helpdesk).
// ---------------------------------------------------------------------------

// Bill PDF-generate worker. Handles direct {workerJobId} jobs and runs a
// repeatable sweep every 2 minutes against pending bill_worker_jobs rows.
const billPdfGenerateWorker = new Worker<BillPdfGenerateJobData>(
  'bill-pdf-generate',
  async (job: Job<BillPdfGenerateJobData>) => {
    await processBillPdfGenerateJob(job, logger);
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);
billPdfGenerateWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bill-pdf-generate' }, 'Job completed');
});
billPdfGenerateWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bill-pdf-generate', err }, 'Job failed');
});
const billPdfGenerateQueue = new Queue('bill-pdf-generate', { connection: redis });
billPdfGenerateQueue
  .upsertJobScheduler(
    'bill-pdf-generate-sweep',
    { pattern: '*/2 * * * *' },
    { name: 'sweep', data: { sweep: true } },
  )
  .catch((err) => logger.error({ err }, 'Failed to register bill-pdf-generate sweep scheduler'));

// Bill email-send worker.
const billEmailSendWorker = new Worker<BillEmailSendJobData>(
  'bill-email-send',
  async (job: Job<BillEmailSendJobData>) => {
    await processBillEmailSendJob(job, env, logger);
  },
  { ...connection, concurrency: 1 },
);
billEmailSendWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bill-email-send' }, 'Job completed');
});
billEmailSendWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bill-email-send', err }, 'Job failed');
});
const billEmailSendQueue = new Queue('bill-email-send', { connection: redis });
billEmailSendQueue
  .upsertJobScheduler(
    'bill-email-send-sweep',
    { pattern: '*/2 * * * *' },
    { name: 'sweep', data: { sweep: true } },
  )
  .catch((err) => logger.error({ err }, 'Failed to register bill-email-send sweep scheduler'));

// Bill overdue-reminder worker (daily at 09:00 UTC).
const billOverdueReminderWorker = new Worker<BillOverdueReminderJobData>(
  'bill-overdue-reminder',
  async (job: Job<BillOverdueReminderJobData>) => {
    await processBillOverdueReminderJob(job, env, logger);
  },
  { ...connection, concurrency: 1 },
);
billOverdueReminderWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bill-overdue-reminder' }, 'Job completed');
});
billOverdueReminderWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bill-overdue-reminder', err }, 'Job failed');
});
const billOverdueReminderQueue = new Queue('bill-overdue-reminder', { connection: redis });
billOverdueReminderQueue
  .upsertJobScheduler(
    'bill-overdue-reminder-daily',
    { pattern: '0 9 * * *' },
    { name: 'daily', data: {} },
  )
  .catch((err) => logger.error({ err }, 'Failed to register bill-overdue-reminder scheduler'));

// Blank confirmation-email worker.
const blankConfirmationEmailWorker = new Worker<BlankConfirmationEmailJobData>(
  'blank-confirmation-email',
  async (job: Job<BlankConfirmationEmailJobData>) => {
    await processBlankConfirmationEmailJob(job, env, logger);
  },
  { ...connection, concurrency: 1 },
);
blankConfirmationEmailWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'blank-confirmation-email' }, 'Job completed');
});
blankConfirmationEmailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'blank-confirmation-email', err }, 'Job failed');
});
const blankConfirmationEmailQueue = new Queue('blank-confirmation-email', { connection: redis });
blankConfirmationEmailQueue
  .upsertJobScheduler(
    'blank-confirmation-email-sweep',
    { pattern: '*/2 * * * *' },
    { name: 'sweep', data: { sweep: true } },
  )
  .catch((err) =>
    logger.error({ err }, 'Failed to register blank-confirmation-email sweep scheduler'),
  );

// Blank file-processing worker.
const blankFileProcessWorker = new Worker<BlankFileProcessJobData>(
  'blank-file-process',
  async (job: Job<BlankFileProcessJobData>) => {
    await processBlankFileProcessJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);
blankFileProcessWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'blank-file-process' }, 'Job completed');
});
blankFileProcessWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'blank-file-process', err }, 'Job failed');
});
const blankFileProcessQueue = new Queue('blank-file-process', { connection: redis });
blankFileProcessQueue
  .upsertJobScheduler(
    'blank-file-process-sweep',
    { pattern: '*/5 * * * *' },
    { name: 'sweep', data: {} },
  )
  .catch((err) => logger.error({ err }, 'Failed to register blank-file-process sweep scheduler'));

// Bench scheduled-report delivery worker.
const benchReportDeliverWorker = new Worker<BenchReportDeliverJobData>(
  'bench-report-deliver',
  async (job: Job<BenchReportDeliverJobData>) => {
    await processBenchReportDeliverJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);
benchReportDeliverWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bench-report-deliver' }, 'Job completed');
});
benchReportDeliverWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bench-report-deliver', err }, 'Job failed');
});

// Bench materialized-view refresh scheduler (every 5 minutes).
const benchMvRefreshWorker = new Worker<BenchMvRefreshJobData>(
  'bench-mv-refresh',
  async (job: Job<BenchMvRefreshJobData>) => {
    await processBenchMvRefreshJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);
benchMvRefreshWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'bench-mv-refresh' }, 'Job completed');
});
benchMvRefreshWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'bench-mv-refresh', err }, 'Job failed');
});
const benchMvRefreshQueue = new Queue('bench-mv-refresh', { connection: redis });
benchMvRefreshQueue
  .upsertJobScheduler(
    'bench-mv-refresh-tick',
    { pattern: '*/5 * * * *' },
    { name: 'tick', data: {} },
  )
  .catch((err) => logger.error({ err }, 'Failed to register bench-mv-refresh scheduler'));

// Brief document embedding worker (every 5 minutes).
const briefEmbedWorker = new Worker<BriefEmbedJobData>(
  'brief-embed',
  async (job: Job<BriefEmbedJobData>) => {
    await processBriefEmbedJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);
briefEmbedWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'brief-embed' }, 'Job completed');
});
briefEmbedWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'brief-embed', err }, 'Job failed');
});
const briefEmbedQueue = new Queue('brief-embed', { connection: redis });
briefEmbedQueue
  .upsertJobScheduler(
    'brief-embed-tick',
    { pattern: '*/5 * * * *' },
    { name: 'tick', data: {} },
  )
  .catch((err) => logger.error({ err }, 'Failed to register brief-embed scheduler'));

// Helpdesk SLA monitor (every 5 minutes).
const helpdeskSlaMonitorWorker = new Worker<HelpdeskSlaMonitorJobData>(
  'helpdesk-sla-monitor',
  async (job: Job<HelpdeskSlaMonitorJobData>) => {
    await processHelpdeskSlaMonitorJob(job, logger);
  },
  { ...connection, concurrency: 1 },
);
helpdeskSlaMonitorWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'helpdesk-sla-monitor' }, 'Job completed');
});
helpdeskSlaMonitorWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'helpdesk-sla-monitor', err }, 'Job failed');
});
const helpdeskSlaMonitorQueue = new Queue('helpdesk-sla-monitor', { connection: redis });
helpdeskSlaMonitorQueue
  .upsertJobScheduler(
    'helpdesk-sla-monitor-tick',
    { pattern: '*/5 * * * *' },
    { name: 'tick', data: {} },
  )
  .catch((err) => logger.error({ err }, 'Failed to register helpdesk-sla-monitor scheduler'));

// Analytics worker (placeholder — processes analytics aggregation jobs)
const analyticsWorker = new Worker(
  'analytics',
  async (job: Job) => {
    logger.info(
      { jobId: job.id, data: job.data },
      'Processing analytics job (placeholder)',
    );
  },
  { ...connection, concurrency: env.WORKER_CONCURRENCY },
);

analyticsWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'analytics' }, 'Job completed');
});

analyticsWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, queue: 'analytics', err }, 'Job failed');
});

// Collect all workers for graceful shutdown
const workers = [
  emailWorker,
  notificationWorker,
  sprintCloseWorker,
  exportWorker,
  banterNotificationWorker,
  banterRetentionWorker,
  helpdeskTaskCreateWorker,
  beaconVectorSyncWorker,
  beaconExpirySweepWorker,
  bearingSnapshotWorker,
  bearingRecomputeWorker,
  bearingDigestWorker,
  boltExecuteWorker,
  boltScheduleTickWorker,
  blastSendWorker,
  bondStaleDealsWorker,
  billPdfGenerateWorker,
  billEmailSendWorker,
  billOverdueReminderWorker,
  blankConfirmationEmailWorker,
  blankFileProcessWorker,
  benchReportDeliverWorker,
  benchMvRefreshWorker,
  briefEmbedWorker,
  helpdeskSlaMonitorWorker,
  analyticsWorker,
];

logger.info(
  {
    queues: [
      'email',
      'notifications',
      'sprint-close',
      'export',
      'banter-notifications',
      'banter-retention',
      'helpdesk-task-create',
      'beacon-vector-sync',
      'beacon-expiry-sweep',
      'bearing-snapshot',
      'bearing-recompute',
      'bearing-digest',
      'bolt-execute',
      'bolt-schedule',
      'blast-send',
      'bond-stale-deals',
      'bill-pdf-generate',
      'bill-email-send',
      'bill-overdue-reminder',
      'blank-confirmation-email',
      'blank-file-process',
      'bench-report-deliver',
      'bench-mv-refresh',
      'brief-embed',
      'helpdesk-sla-monitor',
      'analytics',
    ],
  },
  'All workers started',
);

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal, closing workers...');

  await Promise.all(workers.map((w) => w.close()));
  await closeDb();
  redis.disconnect();

  logger.info('All workers closed. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
