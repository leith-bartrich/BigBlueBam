import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import Redis from 'ioredis';
import { db } from '../db/index.js';
import { sessions } from '../db/schema/sessions.js';
import { users } from '../db/schema/users.js';
import { env } from '../env.js';
import type { AuthUser } from './auth.js';

const REDIS_CHANNEL = 'bigbluebam:events';

interface WsConnection {
  socket: WebSocket;
  user: AuthUser;
  rooms: Set<string>;
}

// Global state
const connectionsByUserId = new Map<string, Set<WsConnection>>();
const connectionsByRoom = new Map<string, Set<WsConnection>>();

let subscriberRedis: Redis | null = null;
let publisherRedis: Redis | null = null;

/**
 * Publish a message to a room via Redis PubSub.
 * All server instances subscribed to the channel will forward
 * the event to their locally-connected clients in that room.
 */
export function broadcast(room: string, event: object): void {
  if (!publisherRedis) {
    throw new Error('WebSocket plugin not initialized — cannot broadcast');
  }
  const payload = JSON.stringify({ room, event });
  publisherRedis.publish(REDIS_CHANNEL, payload).catch((err) => {
    console.error('[ws] Failed to publish to Redis:', err);
  });
}

// ── Helpers ──────────────────────────────────────────────────

function addToRoom(conn: WsConnection, room: string) {
  conn.rooms.add(room);
  let set = connectionsByRoom.get(room);
  if (!set) {
    set = new Set();
    connectionsByRoom.set(room, set);
  }
  set.add(conn);
}

function removeFromRoom(conn: WsConnection, room: string) {
  conn.rooms.delete(room);
  const set = connectionsByRoom.get(room);
  if (set) {
    set.delete(conn);
    if (set.size === 0) connectionsByRoom.delete(room);
  }
}

function removeConnection(conn: WsConnection) {
  // Remove from all rooms
  for (const room of conn.rooms) {
    const set = connectionsByRoom.get(room);
    if (set) {
      set.delete(conn);
      if (set.size === 0) connectionsByRoom.delete(room);
    }
  }
  conn.rooms.clear();

  // Remove from user map
  const userConns = connectionsByUserId.get(conn.user.id);
  if (userConns) {
    userConns.delete(conn);
    if (userConns.size === 0) connectionsByUserId.delete(conn.user.id);
  }
}

function sendToRoom(room: string, message: string) {
  const conns = connectionsByRoom.get(room);
  if (!conns) return;
  for (const conn of conns) {
    if (conn.socket.readyState === 1 /* OPEN */) {
      conn.socket.send(message);
    }
  }
}

async function authenticateRequest(request: FastifyRequest): Promise<AuthUser | null> {
  // The browser sends cookies automatically on the WebSocket upgrade request.
  // Parse the session cookie the same way the auth plugin does.
  const sessionId = request.cookies?.session;
  if (!sessionId) return null;

  const result = await db
    .select({
      session: sessions,
      user: {
        id: users.id,
        org_id: users.org_id,
        email: users.email,
        display_name: users.display_name,
        avatar_url: users.avatar_url,
        role: users.role,
        timezone: users.timezone,
        is_active: users.is_active,
        is_superuser: users.is_superuser,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.user_id, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const row = result[0];
  if (!row) return null;
  if (new Date(row.session.expires_at) <= new Date()) return null;
  if (!row.user.is_active) return null;

  return { ...row.user, api_key_scope: null };
}

// ── Plugin ───────────────────────────────────────────────────

async function websocketPlugin(fastify: FastifyInstance) {
  // Create a dedicated Redis subscriber (ioredis requires a separate
  // connection for subscriptions — you cannot mix sub + pub on one client).
  subscriberRedis = new Redis(env.REDIS_URL, { lazyConnect: true });
  publisherRedis = new Redis(env.REDIS_URL, { lazyConnect: true });

  await subscriberRedis.connect();
  await publisherRedis.connect();

  // Subscribe to the shared events channel
  await subscriberRedis.subscribe(REDIS_CHANNEL);

  subscriberRedis.on('message', (_channel: string, rawMessage: string) => {
    try {
      const { room, event } = JSON.parse(rawMessage) as { room: string; event: object };
      const msg = JSON.stringify(event);
      sendToRoom(room, msg);
    } catch (err) {
      fastify.log.error({ err }, '[ws] Failed to process Redis message');
    }
  });

  // WebSocket route
  fastify.get('/ws', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    // Authenticate
    authenticateRequest(request)
      .then((user) => {
        if (!user) {
          socket.close(4001, 'Unauthorized');
          return;
        }

        const conn: WsConnection = {
          socket,
          user,
          rooms: new Set(),
        };

        // Track by userId
        let userConns = connectionsByUserId.get(user.id);
        if (!userConns) {
          userConns = new Set();
          connectionsByUserId.set(user.id, userConns);
        }
        userConns.add(conn);

        // Auto-subscribe to the user's personal room
        addToRoom(conn, `user:${user.id}`);

        fastify.log.info({ userId: user.id }, '[ws] Client connected');

        // Send a welcome message
        socket.send(JSON.stringify({
          type: 'connected',
          userId: user.id,
        }));

        // Handle incoming messages
        socket.on('message', (raw: Buffer | string) => {
          try {
            const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')) as {
              type: string;
              room?: string;
            };

            if (msg.type === 'subscribe' && msg.room) {
              // Basic validation: only allow project: and user: rooms
              if (msg.room.startsWith('project:') || msg.room.startsWith('user:')) {
                addToRoom(conn, msg.room);
                socket.send(JSON.stringify({ type: 'subscribed', room: msg.room }));
                fastify.log.debug({ userId: user.id, room: msg.room }, '[ws] Room subscribed');
              }
            } else if (msg.type === 'unsubscribe' && msg.room) {
              removeFromRoom(conn, msg.room);
              socket.send(JSON.stringify({ type: 'unsubscribed', room: msg.room }));
              fastify.log.debug({ userId: user.id, room: msg.room }, '[ws] Room unsubscribed');
            } else if (msg.type === 'ping') {
              socket.send(JSON.stringify({ type: 'pong' }));
            }
          } catch {
            // Ignore malformed messages
          }
        });

        // Handle disconnection
        socket.on('close', () => {
          fastify.log.info({ userId: user.id }, '[ws] Client disconnected');
          removeConnection(conn);
        });

        socket.on('error', (err) => {
          fastify.log.error({ err, userId: user.id }, '[ws] Socket error');
          removeConnection(conn);
        });
      })
      .catch((err) => {
        fastify.log.error({ err }, '[ws] Auth error');
        socket.close(4001, 'Unauthorized');
      });
  });

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    if (subscriberRedis) {
      await subscriberRedis.unsubscribe(REDIS_CHANNEL);
      await subscriberRedis.quit();
      subscriberRedis = null;
    }
    if (publisherRedis) {
      await publisherRedis.quit();
      publisherRedis = null;
    }
    // Close all open WebSocket connections
    for (const [, conns] of connectionsByUserId) {
      for (const conn of conns) {
        conn.socket.close(1001, 'Server shutting down');
      }
    }
    connectionsByUserId.clear();
    connectionsByRoom.clear();
  });
}

export default fp(websocketPlugin, {
  name: 'websocket-handler',
  dependencies: ['@fastify/websocket', '@fastify/cookie', 'redis'],
});
