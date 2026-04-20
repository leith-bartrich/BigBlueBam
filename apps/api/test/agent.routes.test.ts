import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ---------- hoisted mocks ----------
const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    },
  };
});

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
    UPLOAD_MAX_FILE_SIZE: 10485760,
    UPLOAD_ALLOWED_TYPES: 'image/*',
    COOKIE_SECURE: false,
  },
}));

vi.mock('../src/db/index.js', () => ({
  db: mockDb,
  connection: { end: vi.fn() },
}));

// Stub the real requireAuth so routes still reference it, but we attach our
// own auth preHandler below that populates request.user based on a synthetic
// x-test-user header. We also export AuthUser as a named type stub so
// agent.routes.ts's `type AuthUser` import resolves.
vi.mock('../src/plugins/auth.js', () => ({
  requireAuth: async (request: any, reply: any) => {
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: [],
          request_id: request.id,
        },
      });
    }
  },
}));

import agentRoutes from '../src/routes/agent.routes.js';

// ---------- test user helpers ----------
interface TestUser {
  id: string;
  active_org_id: string;
  kind: 'human' | 'agent' | 'service';
}

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';

const SERVICE_USER: TestUser = {
  id: '99999999-9999-9999-9999-999999999999',
  active_org_id: ORG_A,
  kind: 'service',
};
const HUMAN_USER: TestUser = {
  id: '88888888-8888-8888-8888-888888888888',
  active_org_id: ORG_A,
  kind: 'human',
};

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorateRequest('user', null);
  app.addHook('preHandler', async (request) => {
    const header = request.headers['x-test-user'];
    if (header === 'service') (request as any).user = SERVICE_USER;
    else if (header === 'human') (request as any).user = HUMAN_USER;
  });
  await app.register(agentRoutes);
  return app;
}

// ---------- drizzle chain mock helpers ----------

// `select().from(agentRunners).where(eq(user_id)).limit(1)` -> rows
function mockSelectFromWhereLimit(rows: any[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  mockDb.select.mockReturnValueOnce({ from });
}

// `insert().values().returning()` -> rows
function mockInsertReturning(rows: any[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const values = vi.fn().mockReturnValue({ returning });
  mockDb.insert.mockReturnValueOnce({ values });
}

// `update().set().where().returning()` -> rows
function mockUpdateReturning(rows: any[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  mockDb.update.mockReturnValueOnce({ set });
}

// Heartbeat path: SELECT-existing, then either UPDATE-returning or INSERT-returning.
function mockHeartbeatNew(insertedRow: any) {
  mockSelectFromWhereLimit([]); // no existing row
  mockInsertReturning([insertedRow]);
}

function mockHeartbeatExisting(existingRow: any, updatedRow: any) {
  mockSelectFromWhereLimit([existingRow]);
  mockUpdateReturning([updatedRow]);
}

// Audit path: SELECT users -> rows, then SELECT activity_log.
function mockAuditFlow(targetUserRow: any[], activityRows: any[]) {
  // First call: SELECT from users.
  mockSelectFromWhereLimit(targetUserRow);
  // Second call: SELECT from activity_log (chain where().orderBy().limit()).
  const limit = vi.fn().mockResolvedValue(activityRows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  mockDb.select.mockReturnValueOnce({ from });
}

// List path: SELECT from agent_runners where().orderBy()
function mockListAgents(rows: any[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  mockDb.select.mockReturnValueOnce({ from });
}

// ---------- tests ----------

describe('agent routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  // ───────── auth / gating ─────────
  describe('POST /v1/agents/heartbeat', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/agents/heartbeat',
        payload: { runner_name: 'x' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 NOT_A_SERVICE_ACCOUNT for a human caller', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/agents/heartbeat',
        headers: { 'x-test-user': 'human' },
        payload: { runner_name: 'intake-worker' },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('NOT_A_SERVICE_ACCOUNT');
    });

    it('inserts a new runner on first heartbeat', async () => {
      const now = new Date().toISOString();
      const row = {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        org_id: ORG_A,
        user_id: SERVICE_USER.id,
        name: 'intake-worker',
        version: '1.2.3',
        capabilities: ['helpdesk.triage'],
        last_heartbeat_at: now,
        first_seen_at: now,
      };
      mockHeartbeatNew(row);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/agents/heartbeat',
        headers: { 'x-test-user': 'service' },
        payload: {
          runner_name: 'intake-worker',
          version: '1.2.3',
          capabilities: ['helpdesk.triage'],
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.user_id).toBe(SERVICE_USER.id);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('idempotently updates the same row on a second heartbeat', async () => {
      const firstRow = {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        org_id: ORG_A,
        user_id: SERVICE_USER.id,
        name: 'intake-worker',
        version: '1.2.3',
        capabilities: ['helpdesk.triage'],
        last_heartbeat_at: new Date(Date.now() - 60_000).toISOString(),
        first_seen_at: new Date(Date.now() - 3_600_000).toISOString(),
      };
      const updatedRow = { ...firstRow, last_heartbeat_at: new Date().toISOString() };
      mockHeartbeatExisting(firstRow, updatedRow);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/agents/heartbeat',
        headers: { 'x-test-user': 'service' },
        payload: { runner_name: 'intake-worker' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(firstRow.id);
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it('returns 400 on malformed payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/agents/heartbeat',
        headers: { 'x-test-user': 'service' },
        payload: { runner_name: '' }, // empty string fails min(1)
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /v1/agents/self-report', () => {
    it('returns 403 NOT_A_SERVICE_ACCOUNT for a human caller', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/agents/self-report',
        headers: { 'x-test-user': 'human' },
        payload: {
          summary: 'done',
          project_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('NOT_A_SERVICE_ACCOUNT');
    });

    it('returns 400 PROJECT_ID_REQUIRED when project_id is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/agents/self-report',
        headers: { 'x-test-user': 'service' },
        payload: { summary: 'done' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('PROJECT_ID_REQUIRED');
    });

    it('writes activity_log with actor_type=service on success', async () => {
      const entry = {
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        project_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        actor_id: SERVICE_USER.id,
        actor_type: 'service',
        action: 'agent.self_report',
        details: { summary: 'done', metrics: { count: 3 } },
        created_at: new Date().toISOString(),
      };
      mockInsertReturning([entry]);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/agents/self-report',
        headers: { 'x-test-user': 'service' },
        payload: {
          summary: 'done',
          metrics: { count: 3 },
          project_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.action).toBe('agent.self_report');
      expect(body.data.actor_type).toBe('service');
    });
  });

  describe('GET /v1/agents/:id/audit', () => {
    const AGENT_ID = '77777777-7777-7777-7777-777777777777';

    it('returns 404 when target user is not in caller org', async () => {
      mockSelectFromWhereLimit([{ org_id: ORG_B, kind: 'service' }]);
      const res = await app.inject({
        method: 'GET',
        url: `/v1/agents/${AGENT_ID}/audit`,
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when target user does not exist', async () => {
      mockSelectFromWhereLimit([]);
      const res = await app.inject({
        method: 'GET',
        url: `/v1/agents/${AGENT_ID}/audit`,
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns filtered activity rows for the requested agent', async () => {
      const rows = [
        {
          id: 'row-1',
          project_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          actor_id: AGENT_ID,
          actor_type: 'service',
          action: 'task.create',
          created_at: new Date(),
        },
      ];
      mockAuditFlow([{ org_id: ORG_A, kind: 'service' }], rows);
      const res = await app.inject({
        method: 'GET',
        url: `/v1/agents/${AGENT_ID}/audit?limit=10`,
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].actor_id).toBe(AGENT_ID);
      expect(body.meta.has_more).toBe(false);
    });
  });

  describe('GET /v1/agents', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/agents' });
      expect(res.statusCode).toBe(401);
    });

    it('returns org-scoped runners in the caller org', async () => {
      const rows = [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          org_id: ORG_A,
          user_id: SERVICE_USER.id,
          name: 'intake-worker',
          last_heartbeat_at: new Date(),
        },
      ];
      mockListAgents(rows);
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents',
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].org_id).toBe(ORG_A);
    });
  });
});
