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
const workers = [emailWorker, notificationWorker, sprintCloseWorker, exportWorker, banterNotificationWorker, banterRetentionWorker, helpdeskTaskCreateWorker, beaconVectorSyncWorker, analyticsWorker];

logger.info(
  { queues: ['email', 'notifications', 'sprint-close', 'export', 'banter-notifications', 'banter-retention', 'helpdesk-task-create', 'beacon-vector-sync', 'analytics'] },
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
