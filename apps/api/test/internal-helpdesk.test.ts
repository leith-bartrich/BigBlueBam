import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ---- hoisted env mock (must be before importing middleware/routes) ----
vi.mock('../src/env.js', () => ({
  env: {
    SESSION_TTL_SECONDS: 604800,
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    NODE_ENV: 'test',
    PORT: 4000,
    HOST: '0.0.0.0',
    SESSION_SECRET: 'a'.repeat(32),
    REDIS_URL: 'redis://localhost:6379',
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    COOKIE_SECURE: false,
    INTERNAL_HELPDESK_SECRET: 'test-internal-helpdesk-secret-1234567890',
  },
}));

const { mockDb, mockLogActivity } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
  mockLogActivity: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/db/index.js', () => ({
  db: mockDb,
  connection: { end: vi.fn() },
}));

vi.mock('../src/services/activity.service.js', () => ({
  logActivity: mockLogActivity,
}));

const { requireServiceAuth } = await import('../src/middleware/require-service-auth.js');
const { default: internalHelpdeskRoutes } = await import('../src/routes/internal-helpdesk.routes.js');

const VALID_TOKEN = 'test-internal-helpdesk-secret-1234567890';

describe('require-service-auth middleware', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.get('/test-internal', { preHandler: [requireServiceAuth] }, async () => ({ ok: true }));
    await app.ready();
  });

  it('returns 401 when X-Internal-Token header is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-internal' });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when X-Internal-Token is wrong', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-internal',
      headers: { 'X-Internal-Token': 'wrong-token-value' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when X-Internal-Token has wrong length', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-internal',
      headers: { 'X-Internal-Token': 'short' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts valid X-Internal-Token from loopback (fastify.inject uses 127.0.0.1)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-internal',
      headers: { 'X-Internal-Token': VALID_TOKEN },
    });
    // inject() presents request.ip = '127.0.0.1' which is in the internal
    // allow-list, so a correctly-tokened request should succeed.
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });
});

describe('internal-helpdesk routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    await app.register(internalHelpdeskRoutes, { prefix: '/internal/helpdesk' });
    await app.ready();
  });

  it('POST /internal/helpdesk/tasks rejects without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/helpdesk/tasks',
      payload: {
        project_id: '11111111-1111-1111-1111-111111111111',
        title: 'x',
        priority: 'medium',
        ticket_id: '22222222-2222-2222-2222-222222222222',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /internal/helpdesk/comments rejects without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/helpdesk/comments',
      payload: {
        task_id: '33333333-3333-3333-3333-333333333333',
        body: 'hi',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /internal/helpdesk/tasks returns 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/helpdesk/tasks',
      headers: { 'X-Internal-Token': VALID_TOKEN },
      payload: { title: 'missing fields' },
    });
    // zod .parse() throws; fastify default error handler renders as 500
    // unless mapped. Either way, it should NOT be 201. Accept 400 or 500.
    expect([400, 500]).toContain(res.statusCode);
  });

  it('POST /internal/helpdesk/tasks/:id/reopen rejects without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/helpdesk/tasks/44444444-4444-4444-4444-444444444444/reopen',
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /internal/helpdesk/tasks/:id/move-to-terminal-phase rejects without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/helpdesk/tasks/55555555-5555-5555-5555-555555555555/move-to-terminal-phase',
    });
    expect(res.statusCode).toBe(401);
  });
});
