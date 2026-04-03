import Redis from 'ioredis';
import { env } from '../env.js';

const REDIS_CHANNEL = 'bigbluebam:events';
let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
    publisher.connect().catch(() => {});
  }
  return publisher;
}

export async function broadcastTaskCreated(projectId: string, task: Record<string, unknown>) {
  try {
    const redis = getPublisher();
    await redis.publish(
      REDIS_CHANNEL,
      JSON.stringify({
        room: `project:${projectId}`,
        type: 'task.created',
        payload: task,
        triggeredBy: null,
      }),
    );
  } catch {
    // Don't fail ticket creation if broadcast fails
  }
}

export async function broadcastTicketStatusChanged(projectId: string, taskId: string, newStatus: string) {
  try {
    const redis = getPublisher();
    await redis.publish(
      REDIS_CHANNEL,
      JSON.stringify({
        room: `project:${projectId}`,
        type: 'task.updated',
        payload: { id: taskId, status: newStatus },
        triggeredBy: null,
      }),
    );
  } catch {
    // Don't fail if broadcast fails
  }
}
