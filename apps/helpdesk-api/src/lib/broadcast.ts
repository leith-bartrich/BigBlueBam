// NOTE (HB-47): Redis pub/sub is NOT durable. Messages published here are
// delivered only to subscribers currently connected at publish time.
// Offline subscribers WILL miss events — there is no replay buffer or
// guaranteed delivery. Clients MUST refetch authoritative state after
// reconnecting (e.g. refetch ticket/task lists on WebSocket reconnect)
// to avoid stale UI caused by events missed during disconnection.
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
  const channel = REDIS_CHANNEL;
  const room = `project:${projectId}`;
  try {
    const redis = getPublisher();
    await redis.publish(
      channel,
      JSON.stringify({
        room,
        type: 'task.created',
        payload: task,
        triggeredBy: null,
      }),
    );
  } catch (err) {
    console.warn('[broadcast] Failed to publish:', { channel, room, error: err });
  }
}

export async function broadcastTicketStatusChanged(projectId: string, taskId: string, newStatus: string) {
  const channel = REDIS_CHANNEL;
  const room = `project:${projectId}`;
  try {
    const redis = getPublisher();
    await redis.publish(
      channel,
      JSON.stringify({
        room,
        type: 'task.updated',
        payload: { id: taskId, status: newStatus },
        triggeredBy: null,
      }),
    );
  } catch (err) {
    console.warn('[broadcast] Failed to publish:', { channel, room, error: err });
  }
}

export async function broadcastTicketMessage(ticketId: string, message: Record<string, unknown>) {
  const channel = REDIS_CHANNEL;
  const room = `ticket:${ticketId}`;
  try {
    const redis = getPublisher();
    await redis.publish(
      channel,
      JSON.stringify({
        room,
        type: 'ticket.message.created',
        payload: message,
        triggeredBy: null,
      }),
    );
  } catch (err) {
    console.warn('[broadcast] Failed to publish:', { channel, room, error: err });
  }
}
