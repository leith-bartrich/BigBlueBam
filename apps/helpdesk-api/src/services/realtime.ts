import Redis from 'ioredis';
import { env } from '../env.js';
import { db } from '../db/index.js';
import { helpdeskTicketEvents } from '../db/schema/ticket-events.js';

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

/**
 * HB-47: Persist the event to `helpdesk_ticket_events` BEFORE publishing to
 * Redis PubSub. The DB row becomes the source of truth so a reconnecting
 * client can replay missed events by `id > last_seen_id`. The PubSub publish
 * is the push-optimization for already-connected clients.
 *
 * If the DB write fails we log at error and STILL publish — we prefer a
 * live push for connected subscribers over a silent drop. Failures are
 * rare and observable via logs.
 *
 * Returns the persisted event id (or null if the DB write failed) so the
 * caller can attach it to the outbound payload.
 */
async function persist(ticketId: string, eventType: string, payload: Record<string, unknown>): Promise<number | null> {
  try {
    const [row] = await db
      .insert(helpdeskTicketEvents)
      .values({ ticket_id: ticketId, event_type: eventType, payload })
      .returning({ id: helpdeskTicketEvents.id });
    return row?.id ?? null;
  } catch (err) {
    console.error('[realtime] Failed to persist ticket event:', {
      ticketId,
      eventType,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function publish(room: string, event: HelpdeskEvent) {
  try {
    const redis = getPublisher();
    await redis.publish(REDIS_CHANNEL, JSON.stringify({ room, event }));
  } catch {
    // Don't fail caller if broadcast fails
  }
}

async function persistAndPublish(
  ticketId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const eventId = await persist(ticketId, eventType, payload);
  // Attach the DB id so clients can persist it as their high-water mark.
  // When the DB write fails, event_id is null and the client should fall
  // back to its previous refetch-on-reconnect strategy.
  const enriched: Record<string, unknown> = { ...payload, event_id: eventId };
  await publish(`ticket:${ticketId}`, {
    type: eventType,
    data: enriched,
    timestamp: new Date().toISOString(),
  });
}

export async function broadcastTicketMessage(
  ticketId: string,
  payload: Record<string, unknown>,
) {
  return persistAndPublish(ticketId, 'ticket.message.created', payload);
}

export async function broadcastTicketStatusChanged(ticketId: string, status: string) {
  return persistAndPublish(ticketId, 'ticket.status.changed', {
    ticket_id: ticketId,
    status,
  });
}

export async function broadcastTicketUpdated(
  ticketId: string,
  payload: Record<string, unknown>,
) {
  return persistAndPublish(ticketId, 'ticket.updated', {
    ticket_id: ticketId,
    ...payload,
  });
}
