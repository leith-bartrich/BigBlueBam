import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import Redis from 'ioredis';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions, users } from '../db/schema/index.js';
import { env } from '../env.js';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  orgId: string;
  rooms: Set<string>;
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
  // Redis subscriber for PubSub
  const subscriber = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  await subscriber.connect();

  await subscriber.subscribe('banter:events');

  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const { room, event } = JSON.parse(message);
      const payload = JSON.stringify(event);
      broadcastToRoom(room, payload);
    } catch {
      fastify.log.error('Failed to parse PubSub message');
    }
  });

  fastify.addHook('onClose', async () => {
    await subscriber.quit();
  });

  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    // Authenticate via session cookie
    const sessionId = request.cookies?.session;
    if (!sessionId) {
      socket.close(4001, 'Authentication required');
      return;
    }

    const result = await db
      .select({
        session: sessions,
        user: {
          id: users.id,
          org_id: users.org_id,
          email: users.email,
          display_name: users.display_name,
          role: users.role,
          is_active: users.is_active,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.user_id, users.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    const row = result[0];
    if (!row || new Date(row.session.expires_at) <= new Date() || !row.user.is_active) {
      socket.close(4001, 'Invalid or expired session');
      return;
    }

    const userId = row.user.id;
    const orgId = row.user.org_id;

    // Auto-subscribe to personal and org rooms
    const defaultRooms = new Set([`banter:user:${userId}`, `banter:org:${orgId}`]);

    const client: ConnectedClient = {
      ws: socket,
      userId,
      orgId,
      rooms: defaultRooms,
    };
    clients.set(socket, client);

    // Send connected confirmation
    socket.send(
      JSON.stringify({
        type: 'connected',
        data: { user_id: userId, org_id: orgId },
        timestamp: new Date().toISOString(),
      }),
    );

    socket.on('message', async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (msg.type) {
          case 'subscribe': {
            const room = msg.room as string;
            if (room && room.startsWith('banter:channel:')) {
              client.rooms.add(room);
              socket.send(
                JSON.stringify({
                  type: 'subscribed',
                  data: { room },
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
          case 'typing.start': {
            const channelId = msg.channel_id as string;
            if (channelId) {
              const room = `banter:channel:${channelId}`;
              const payload = JSON.stringify({
                type: 'typing.start',
                data: {
                  channel_id: channelId,
                  user_id: userId,
                  display_name: row.user.display_name,
                },
                timestamp: new Date().toISOString(),
              });
              broadcastToRoom(room, payload, socket);

              // Set typing key in Redis with 5s TTL
              await fastify.redis.setex(`banter:typing:${channelId}:${userId}`, 5, '1');
            }
            break;
          }
          case 'typing.stop': {
            const channelId = msg.channel_id as string;
            if (channelId) {
              const room = `banter:channel:${channelId}`;
              const payload = JSON.stringify({
                type: 'typing.stop',
                data: {
                  channel_id: channelId,
                  user_id: userId,
                },
                timestamp: new Date().toISOString(),
              });
              broadcastToRoom(room, payload, socket);

              await fastify.redis.del(`banter:typing:${channelId}:${userId}`);
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

    socket.on('close', () => {
      clients.delete(socket);
    });

    socket.on('error', () => {
      clients.delete(socket);
    });
  });
}
