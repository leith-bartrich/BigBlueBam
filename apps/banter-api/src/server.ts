import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { env } from './env.js';
import { db, connection } from './db/index.js';
import redisPlugin from './plugins/redis.js';
import authPlugin from './plugins/auth.js';
import { setRedisPublisher } from './services/realtime.js';
import websocketHandler from './ws/handler.js';
import channelRoutes from './routes/channel.routes.js';
import dmRoutes from './routes/dm.routes.js';
import messageRoutes from './routes/message.routes.js';
import threadRoutes from './routes/thread.routes.js';
import reactionRoutes from './routes/reaction.routes.js';
import pinRoutes from './routes/pin.routes.js';
import bookmarkRoutes from './routes/bookmark.routes.js';
import preferenceRoutes from './routes/preference.routes.js';
import fileRoutes from './routes/file.routes.js';
import { sql } from 'drizzle-orm';

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  genReqId: () => crypto.randomUUID(),
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  // Zod validation errors
  if (error.name === 'ZodError') {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: (error as any).issues ?? [],
        request_id: request.id,
      },
    });
  }

  fastify.log.error(error);

  const statusCode = error.statusCode ?? 500;
  return reply.status(statusCode).send({
    error: {
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
      message: statusCode >= 500 ? 'Internal server error' : error.message,
      details: [],
      request_id: request.id,
    },
  });
});

// Plugins
await fastify.register(cors, {
  origin: env.CORS_ORIGIN.split(','),
  credentials: true,
});

await fastify.register(cookie, {
  secret: env.SESSION_SECRET,
});

await fastify.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
});

await fastify.register(websocket);

// Redis plugin
await fastify.register(redisPlugin);

// Initialize realtime publisher with the redis instance
fastify.addHook('onReady', async () => {
  setRedisPublisher(fastify.redis);
});

// Auth plugin
await fastify.register(authPlugin);

// Health endpoints
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/health/ready', async (_request, reply) => {
  const checks: Record<string, string> = {};

  // Check database
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Check Redis
  try {
    await fastify.redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const statusCode = allOk ? 200 : 503;

  return reply.status(statusCode).send({
    status: allOk ? 'ready' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Routes
await fastify.register(channelRoutes);
await fastify.register(dmRoutes);
await fastify.register(messageRoutes);
await fastify.register(threadRoutes);
await fastify.register(reactionRoutes);
await fastify.register(pinRoutes);
await fastify.register(bookmarkRoutes);
await fastify.register(preferenceRoutes);
await fastify.register(fileRoutes);

// WebSocket handler
await fastify.register(websocketHandler);

// Graceful shutdown
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    await fastify.close();
    await connection.end();
    process.exit(0);
  });
}

// Start server
try {
  await fastify.listen({ port: env.PORT, host: env.HOST });
  fastify.log.info(`Banter API listening on ${env.HOST}:${env.PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
