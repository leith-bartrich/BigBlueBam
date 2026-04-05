import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../env.js';

/**
 * Queue client for HB-23: async fallback for ticket → BBB task creation.
 *
 * When inline task creation fails (after E2's transaction fix), the ticket
 * is persisted alone and this queue is used to retry task creation out-of-band.
 * The worker job (apps/worker/src/jobs/helpdesk-task-create.job.ts) consumes
 * these messages and back-links the new task onto the ticket.
 */

export interface HelpdeskTaskCreateJobData {
  ticket_id: string;
  ticket_number: number;
  project_id: string;
  phase_id: string | null;
  label_ids: string[];
  title: string;
  description: string;
  description_plain: string;
  priority: string;
  human_id: string;
  helpdesk_customer_id: string;
  helpdesk_customer_email: string;
  retry_count: number;
}

let queue: Queue | null = null;

function getQueue(): Queue {
  if (!queue) {
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue('helpdesk-task-create', { connection });
  }
  return queue;
}

export async function enqueueTaskCreation(data: HelpdeskTaskCreateJobData): Promise<void> {
  try {
    await getQueue().add('create-task', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  } catch (err) {
    // Enqueue failures must never break the ticket-creation path — they
    // are already the fallback for a prior failure. Log and move on.
    console.error('[task-queue] Failed to enqueue:', err);
  }
}

export async function closeTaskQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
