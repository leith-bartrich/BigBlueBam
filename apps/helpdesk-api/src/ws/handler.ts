import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import Redis from 'ioredis';
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { helpdeskSessions } from '../db/schema/helpdesk-sessions.js';
import { helpdeskUsers } from '../db/schema/helpdesk-users.js';
import { tickets } from '../db/schema/tickets.js';
import { helpdeskTicketEvents } from '../db/schema/ticket-events.js';
import { env } from '../env.js';

// HB-47: cap the number of events sent in a single resume batch so one
// long-disconnected client can't block the server on a giant query. If
// there's more, the client can call `resume` again with the updated
// last_seen_id (or hit GET /helpdesk/events for pagination).
const RESUME_BATCH_LIMIT = 200;

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  rooms: Set<string>;
  pingInterval?: NodeJS.Timeout;
  /** Last time this client emitted typing.start per ticket (ms epoch) — server-side throttle. */
  lastTypingAt: Map<string, number>;
}

const clients = new Map<WebSocket, ConnectedClient>();

const TYPING_THROTTLE_MS = 2000;

function broadcastToRoom(room: string, message: string, excludeWs?: WebSocket) {
  for (const [ws, client] of clients) {
    if (client.rooms.has(room) && ws !== excludeWs && ws.readyState === 1) {
      ws.send(message);
    }
  }
}

export default async function websocketHandler(fastify: FastifyInstance) {
  // Redis subscriber for PubSub — uses same channel as Bam/Banter
  const subscriber = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  await subscriber.connect();

  await subscriber.subscribe('bigbluebam:events');

  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const parsed = JSON.parse(message);
      // Support both {room, event} shape (Banter) and {room, type, payload} shape (Bam)
      const room: string = parsed.room;
      if (!room) return;
      let payload: string;
      if (parsed.event) {
        payload = JSON.stringify(parsed.event);
      } else {
        payload = JSON.stringify({
          type: parsed.type,
          data: parsed.payload,
          timestamp: new Date().toISOString(),
        });
      }
      broadcastToRoom(room, payload);
    } catch {
      fastify.log.error('Failed to parse PubSub message');
    }
  });

  fastify.addHook('onClose', async () => {
    for (const [, client] of clients) {
      if (client.pingInterval) clearInterval(client.pingInterval);
    }
    await subscriber.quit();
  });

  fastify.get('/helpdesk/ws', { websocket: true }, async (socket, request) => {
    // Authenticate via helpdesk_session cookie
    const sessionId = request.cookies?.helpdesk_session;
    if (!sessionId) {
      socket.close(4001, 'Authentication required');
      return;
    }

    const result = await db
      .select({
        session: helpdeskSessions,
        user: {
          id: helpdeskUsers.id,
          email: helpdeskUsers.email,
          display_name: helpdeskUsers.display_name,
          is_active: helpdeskUsers.is_active,
        },
      })
      .from(helpdeskSessions)
      .innerJoin(helpdeskUsers, eq(helpdeskSessions.user_id, helpdeskUsers.id))
      .where(eq(helpdeskSessions.id, sessionId))
      .limit(1);

    const row = result[0];
    if (!row || new Date(row.session.expires_at) <= new Date() || !row.user.is_active) {
      socket.close(4001, 'Invalid or expired session');
      return;
    }

    const userId = row.user.id;
    const userName = row.user.display_name;

    // Auto-subscribe to personal user room
    const defaultRooms = new Set([`helpdesk:user:${userId}`]);

    const client: ConnectedClient = {
      ws: socket,
      userId,
      userName,
      rooms: defaultRooms,
      lastTypingAt: new Map(),
    };
    clients.set(socket, client);

    // Send connected confirmation
    socket.send(
      JSON.stringify({
        type: 'connected',
        data: { user_id: userId },
        timestamp: new Date().toISOString(),
      }),
    );

    // HB-47: tell the client the current high-water mark of the event log
    // immediately after auth. The client compares this to its locally
    // persisted `lastSeenEventId` and, if it's behind, sends a `resume`
    // message to replay anything it missed while disconnected.
    try {
      const [latest] = await db
        .select({ max: sql<string | null>`MAX(${helpdeskTicketEvents.id})` })
        .from(helpdeskTicketEvents);
      const latestId = latest?.max != null ? Number(latest.max) : 0;
      socket.send(
        JSON.stringify({
          type: 'welcome',
          data: { latest_id: latestId },
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to compute welcome latest_id');
      socket.send(
        JSON.stringify({
          type: 'welcome',
          data: { latest_id: 0 },
          timestamp: new Date().toISOString(),
        }),
      );
    }

    // Heartbeat ping every 30s
    client.pingInterval = setInterval(() => {
      if (socket.readyState === 1) {
        try {
          socket.ping();
        } catch {
          /* ignore */
        }
      }
    }, 30000);

    socket.on('message', async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (msg.type) {
          case 'ping': {
            socket.send(
              JSON.stringify({
                type: 'pong',
                data: {},
                timestamp: new Date().toISOString(),
              }),
            );
            break;
          }
          case 'subscribe': {
            const room = msg.room as string;
            if (!room) break;

            // Customers can only subscribe to ticket rooms they own
            if (room.startsWith('ticket:')) {
              const ticketId = room.slice('ticket:'.length);
              const ticketRows = await db
                .select({ helpdesk_user_id: tickets.helpdesk_user_id })
                .from(tickets)
                .where(eq(tickets.id, ticketId))
                .limit(1);
              const ticket = ticketRows[0];
              if (!ticket || ticket.helpdesk_user_id !== userId) {
                socket.send(
                  JSON.stringify({
                    type: 'subscribe_error',
                    data: { room, reason: 'forbidden' },
                    timestamp: new Date().toISOString(),
                  }),
                );
                break;
              }
              client.rooms.add(room);
              socket.send(
                JSON.stringify({
                  type: 'subscribed',
                  data: { room },
                  timestamp: new Date().toISOString(),
                }),
              );
            } else {
              // Disallow subscribing to arbitrary rooms
              socket.send(
                JSON.stringify({
                  type: 'subscribe_error',
                  data: { room, reason: 'invalid_room' },
                  timestamp: new Date().toISOString(),
                }),
              );
            }
            break;
          }
          case 'typing.start':
          case 'typing.stop': {
            const ticketId = (msg.ticketId ?? msg.ticket_id) as string | undefined;
            if (!ticketId) break;

            // Verify access: customers can only signal typing on tickets they own.
            const ticketRows = await db
              .select({ helpdesk_user_id: tickets.helpdesk_user_id })
              .from(tickets)
              .where(eq(tickets.id, ticketId))
              .limit(1);
            const ticket = ticketRows[0];
            if (!ticket || ticket.helpdesk_user_id !== userId) break;

            // Server-side throttle (only applies to typing.start; stop is always forwarded).
            if (msg.type === 'typing.start') {
              const last = client.lastTypingAt.get(ticketId) ?? 0;
              const now = Date.now();
              if (now - last < TYPING_THROTTLE_MS) break;
              client.lastTypingAt.set(ticketId, now);
            } else {
              // Reset throttle on explicit stop so the next start is emitted immediately.
              client.lastTypingAt.delete(ticketId);
            }

            const room = `ticket:${ticketId}`;
            const payload = JSON.stringify({
              type: msg.type,
              payload: {
                ticket_id: ticketId,
                user_id: userId,
                display_name: userName,
              },
              room,
              timestamp: new Date().toISOString(),
            });
            broadcastToRoom(room, payload, socket);
            break;
          }
          case 'resume': {
            // HB-47: client caught up to `last_seen_id` — replay any events
            // with id > last_seen_id for tickets the caller owns. Capped at
            // RESUME_BATCH_LIMIT; if has_more is true the client should
            // call resume again with the new last_seen_id.
            const lastSeen = Number(msg.last_seen_id);
            if (!Number.isFinite(lastSeen) || lastSeen < 0) {
              socket.send(
                JSON.stringify({
                  type: 'resume_error',
                  data: { reason: 'invalid_last_seen_id' },
                  timestamp: new Date().toISOString(),
                }),
              );
              break;
            }

            // Scope to tickets owned by the connected customer. This is
            // the same ownership check used by GET /helpdesk/events — a
            // customer can only ever replay events for their own tickets.
            const ownedTickets = await db
              .select({ id: tickets.id })
              .from(tickets)
              .where(eq(tickets.helpdesk_user_id, userId));

            if (ownedTickets.length === 0) {
              socket.send(
                JSON.stringify({
                  type: 'resume_complete',
                  data: { events: [], has_more: false, latest_id: lastSeen },
                  timestamp: new Date().toISOString(),
                }),
              );
              break;
            }

            const ownedIds = ownedTickets.map((t) => t.id);
            const rows = await db
              .select({
                id: helpdeskTicketEvents.id,
                ticket_id: helpdeskTicketEvents.ticket_id,
                event_type: helpdeskTicketEvents.event_type,
                payload: helpdeskTicketEvents.payload,
                created_at: helpdeskTicketEvents.created_at,
              })
              .from(helpdeskTicketEvents)
              .where(
                and(
                  inArray(helpdeskTicketEvents.ticket_id, ownedIds),
                  gt(helpdeskTicketEvents.id, lastSeen),
                ),
              )
              .orderBy(asc(helpdeskTicketEvents.id))
              .limit(RESUME_BATCH_LIMIT + 1);

            const hasMore = rows.length > RESUME_BATCH_LIMIT;
            const batch = hasMore ? rows.slice(0, RESUME_BATCH_LIMIT) : rows;
            const latestId = batch.length > 0 ? batch[batch.length - 1]!.id : lastSeen;

            socket.send(
              JSON.stringify({
                type: 'resume_complete',
                data: { events: batch, has_more: hasMore, latest_id: latestId },
                timestamp: new Date().toISOString(),
              }),
            );
            break;
          }
          case 'unsubscribe': {
            const room = msg.room as string;
            if (room) {
              client.rooms.delete(room);
              socket.send(
                JSON.stringify({
                  type: 'unsubscribed',
                  data: { room },
                  timestamp: new Date().toISOString(),
                }),
              );
            }
            break;
          }
          default:
            break;
        }
      } catch {
        fastify.log.warn('Invalid WebSocket message received');
      }
    });

    const cleanup = () => {
      if (client.pingInterval) clearInterval(client.pingInterval);
      clients.delete(socket);
    };

    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });
}
