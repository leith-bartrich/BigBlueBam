import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

export interface NotificationJobData {
  user_id: string;
  project_id: string;
  task_id?: string;
  type: string;
  title: string;
  body: string;
}

export async function processNotificationJob(
  job: Job<NotificationJobData>,
  logger: Logger,
): Promise<void> {
  const { user_id, project_id, task_id, type, title, body } = job.data;

  logger.info(
    { jobId: job.id, user_id, project_id, type, title },
    'Processing notification job',
  );

  const db = getDb();

  await db.execute(sql`
    INSERT INTO notifications (id, user_id, project_id, task_id, type, title, body, is_read, created_at)
    VALUES (
      gen_random_uuid(),
      ${user_id},
      ${project_id},
      ${task_id ?? null},
      ${type},
      ${title},
      ${body},
      false,
      NOW()
    )
  `);

  logger.info(
    { jobId: job.id, user_id, type, title },
    'Notification created successfully',
  );
}
