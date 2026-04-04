import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import Redis from 'ioredis';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { helpdeskSessions } from '../db/schema/helpdesk-sessions.js';
import { helpdeskUsers } from '../db/schema/helpdesk-users.js';
import { tickets } from '../db/schema/tickets.js';
import { env } from '../env.js';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  rooms: Set<string>;
  pingInterval?: NodeJS.Timeout;
}

const clients = new Map<WebSocket, ConnectedClient>();

function broadcastToRoom(room: string, message: string, excludeWs?: WebSocket) {
  for (const [ws, client] of clients) {
    if (client.rooms.has(room) && ws !== excludeWs && ws.readyState === 1) {
      ws.send(message);
    }
  }
}

export default async function websocketHandler(fastify: FastifyInstance) {
  // Redis subscriber for PubSub — uses same channel as BBB/Banter
  const subscriber = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  await subscriber.connect();

  await subscriber.subscribe('bigbluebam:events');

  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const parsed = JSON.parse(message);
      // Support both {room, event} shape (Banter) and {room, type, payload} shape (BBB)
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

    // Auto-subscribe to personal user room
    const defaultRooms = new Set([`helpdesk:user:${userId}`]);

    const client: ConnectedClient = {
      ws: socket,
      userId,
      rooms: defaultRooms,
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
