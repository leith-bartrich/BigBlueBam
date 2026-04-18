// §13 Wave 4 scheduled banter — scheduled-post service.
//
// Inserts a `banter_scheduled_messages` row and enqueues a BullMQ delayed
// job on the `banter-scheduled-post` queue. The durable row is the source
// of truth: if Redis is flushed the worker's startup reconciler re-enqueues
// every `status='pending'` row.

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { banterScheduledMessages } from '../db/schema/index.js';
import { env } from '../env.js';

// Channel rate limits and per-route rate limits already cover the POST path.
// No additional rate-limiting is applied here beyond the default horizon cap.
const MAX_HORIZON_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let queue: Queue | null = null;
function getQueue(): Queue {
  if (!queue) {
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue('banter-scheduled-post', { connection });
  }
  return queue;
}

export interface ScheduledPostInput {
  org_id: string;
  channel_id: string;
  author_id: string;
  content: string;
  content_format: 'html' | 'markdown' | 'plain';
  thread_parent_id: string | null;
  metadata: Record<string, unknown>;
  scheduled_at: Date;
  defer_reason: 'scheduled' | 'quiet_hours';
}

export interface ScheduledPostRow {
  id: string;
  org_id: string;
  channel_id: string;
  author_id: string;
  scheduled_at: Date;
  status: string;
  defer_reason: string | null;
  bullmq_job_id: string | null;
}

export class ScheduledPostError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export async function scheduleMessage(
  input: ScheduledPostInput,
): Promise<ScheduledPostRow> {
  const now = Date.now();
  const target = input.scheduled_at.getTime();
  if (!Number.isFinite(target)) {
    throw new ScheduledPostError('INVALID_SCHEDULED_AT', 'scheduled_at is not a valid date');
  }
  if (target <= now) {
    throw new ScheduledPostError(
      'SCHEDULED_AT_IN_PAST',
      'scheduled_at must be strictly in the future',
    );
  }
  if (target - now > MAX_HORIZON_MS) {
    throw new ScheduledPostError(
      'SCHEDULED_AT_HORIZON_EXCEEDED',
      'scheduled_at must be within 30 days from now',
    );
  }

  const [row] = await db
    .insert(banterScheduledMessages)
    .values({
      org_id: input.org_id,
      channel_id: input.channel_id,
      author_id: input.author_id,
      content: input.content,
      content_format: input.content_format,
      thread_parent_id: input.thread_parent_id,
      metadata: input.metadata,
      scheduled_at: input.scheduled_at,
      status: 'pending',
      defer_reason: input.defer_reason,
    })
    .returning();

  if (!row) {
    throw new ScheduledPostError('INSERT_FAILED', 'failed to insert scheduled message row');
  }

  const delay = Math.max(0, target - now);
  let jobId: string | null = null;
  try {
    const job = await getQueue().add(
      'scheduled-post',
      { scheduled_message_id: row.id },
      {
        delay,
        jobId: `banter-scheduled-post:${row.id}`,
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    );
    jobId = typeof job.id === 'string' ? job.id : null;
    if (jobId) {
      await db
        .update(banterScheduledMessages)
        .set({ bullmq_job_id: jobId })
        .where(eq(banterScheduledMessages.id, row.id));
    }
  } catch {
    // Queue push failed — the row is still pending and the worker
    // reconciler will re-enqueue on startup. Callers see success.
  }

  return {
    id: row.id,
    org_id: row.org_id,
    channel_id: row.channel_id,
    author_id: row.author_id,
    scheduled_at: row.scheduled_at,
    status: row.status,
    defer_reason: row.defer_reason,
    bullmq_job_id: jobId,
  };
}
