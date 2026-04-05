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

export interface HelpdeskEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

async function publish(room: string, event: HelpdeskEvent) {
  try {
    const redis = getPublisher();
    await redis.publish(REDIS_CHANNEL, JSON.stringify({ room, event }));
  } catch {
    // Don't fail caller if broadcast fails
  }
}

export async function broadcastTicketMessage(
  ticketId: string,
  payload: Record<string, unknown>,
) {
  return publish(`ticket:${ticketId}`, {
    type: 'ticket.message.created',
    data: payload,
    timestamp: new Date().toISOString(),
  });
}

export async function broadcastTicketStatusChanged(ticketId: string, status: string) {
  return publish(`ticket:${ticketId}`, {
    type: 'ticket.status.changed',
    data: { ticket_id: ticketId, status },
    timestamp: new Date().toISOString(),
  });
}
