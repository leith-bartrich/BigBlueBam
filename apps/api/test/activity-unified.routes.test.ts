import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ---------- hoisted mocks ----------
const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      select: vi.fn(),
      execute: vi.fn(),
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

import activityUnifiedRoutes from '../src/routes/activity-unified.routes.js';

// ---------- constants ----------
const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';
const USER_HUMAN = '88888888-8888-8888-8888-888888888888';
const USER_TARGET_SAME_ORG = '77777777-7777-7777-7777-777777777777';
const USER_TARGET_OTHER_ORG = '66666666-6666-6666-6666-666666666666';

const ENTITY_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ROW_ID_BAM = 'a1111111-1111-1111-1111-111111111111';
const ROW_ID_BOND = 'b2222222-2222-2222-2222-222222222222';
const ROW_ID_HELPDESK = 'c3333333-3333-3333-3333-333333333333';

interface TestUser {
  id: string;
  active_org_id: string;
  kind: 'human' | 'agent' | 'service';
  role: string;
}

const HUMAN_USER: TestUser = {
  id: USER_HUMAN,
  active_org_id: ORG_A,
  kind: 'human',
  role: 'member',
};

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorateRequest('user', null);
  app.addHook('preHandler', async (request) => {
    const header = request.headers['x-test-user'];
    if (header === 'human') (request as any).user = HUMAN_USER;
  });
  await app.register(activityUnifiedRoutes);
  return app;
}

// ---------- drizzle chain helpers ----------

function mockSelectFromWhereLimit(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  mockDb.select.mockReturnValueOnce({ from });
}

function mockExecute(rows: unknown[]) {
  mockDb.execute.mockResolvedValueOnce(rows);
}

// ---------- tests ----------

describe('activity-unified routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  // ────────────────────────────────────────────────────────────────────
  // GET /v1/activity/unified
  // ────────────────────────────────────────────────────────────────────
  describe('GET /v1/activity/unified', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/activity/unified?entity_type=bam.task&entity_id=${ENTITY_ID}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 400 when entity_type is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/activity/unified?entity_id=${ENTITY_ID}`,
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when entity_id is not a UUID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/activity/unified?entity_type=bam.task&entity_id=not-a-uuid',
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('returns rows from all three source apps under normalized shape', async () => {
      const now = new Date('2026-04-18T10:00:00Z');
      const rows = [
        {
          id: ROW_ID_BAM,
          source_app: 'bam',
          entity_type: 'bam.task',
          entity_id: ENTITY_ID,
          project_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          organization_id: null,
          actor_id: USER_HUMAN,
          actor_type: 'human',
          action: 'task.create',
          details: { foo: 'bar' },
          created_at: now,
        },
        {
          id: ROW_ID_BOND,
          source_app: 'bond',
          entity_type: 'bond.deal',
          entity_id: ENTITY_ID,
          project_id: null,
          organization_id: ORG_A,
          actor_id: USER_HUMAN,
          actor_type: 'service',
          action: 'stage_change',
          details: { subject: null, body: null, metadata: {} },
          created_at: new Date('2026-04-18T09:00:00Z'),
        },
        {
          id: ROW_ID_HELPDESK,
          source_app: 'helpdesk',
          entity_type: 'helpdesk.ticket',
          entity_id: ENTITY_ID,
          project_id: null,
          organization_id: null,
          actor_id: USER_HUMAN,
          actor_type: 'human', // note: 'agent' on raw side was remapped to 'human'
          action: 'status_change',
          details: { from: 'open', to: 'resolved' },
          created_at: new Date('2026-04-18T08:00:00Z'),
        },
      ];
      mockExecute(rows);

      const res = await app.inject({
        method: 'GET',
        url: `/v1/activity/unified?entity_type=bam.task&entity_id=${ENTITY_ID}`,
        headers: { 'x-test-user': 'human' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(3);
      expect(body.data[0].source_app).toBe('bam');
      expect(body.data[1].source_app).toBe('bond');
      expect(body.data[2].source_app).toBe('helpdesk');
      // Verify actor_type remap landed: helpdesk rows surface as human, not agent.
      expect(body.data[2].actor_type).toBe('human');
      // created_at should be serialized as ISO string.
      expect(typeof body.data[0].created_at).toBe('string');
    });

    it('paginates with cursor when more rows are available', async () => {
      // Return limit+1 rows to signal has_more.
      const base = new Date('2026-04-18T10:00:00Z').getTime();
      const rows = Array.from({ length: 3 }, (_, i) => ({
        id: `aaaaaaaa-0000-0000-0000-00000000000${i}`,
        source_app: 'bam',
        entity_type: 'bam.task',
        entity_id: ENTITY_ID,
        project_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        organization_id: null,
        actor_id: USER_HUMAN,
        actor_type: 'human',
        action: 'task.update',
        details: {},
        created_at: new Date(base - i * 1000),
      }));
      mockExecute(rows);

      const res = await app.inject({
        method: 'GET',
        url: `/v1/activity/unified?entity_type=bam.task&entity_id=${ENTITY_ID}&limit=2`,
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(2);
      expect(body.meta.has_more).toBe(true);
      expect(body.meta.next_cursor).toContain('|');
    });

    it('returns empty page with no cursor when under-limit', async () => {
      mockExecute([]);
      const res = await app.inject({
        method: 'GET',
        url: `/v1/activity/unified?entity_type=bam.task&entity_id=${ENTITY_ID}`,
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(0);
      expect(body.meta.has_more).toBe(false);
      expect(body.meta.next_cursor).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // GET /v1/activity/unified/by-actor
  // ────────────────────────────────────────────────────────────────────
  describe('GET /v1/activity/unified/by-actor', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/activity/unified/by-actor?actor_id=${USER_TARGET_SAME_ORG}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 400 when actor_id is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/activity/unified/by-actor',
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when target actor does not exist', async () => {
      mockSelectFromWhereLimit([]);
      const res = await app.inject({
        method: 'GET',
        url: `/v1/activity/unified/by-actor?actor_id=${USER_TARGET_SAME_ORG}`,
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when target actor is in a different org (no existence disclosure)', async () => {
      mockSelectFromWhereLimit([{ org_id: ORG_B }]);
      const res = await app.inject({
        method: 'GET',
        url: `/v1/activity/unified/by-actor?actor_id=${USER_TARGET_OTHER_ORG}`,
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns rows when target shares caller active org', async () => {
      mockSelectFromWhereLimit([{ org_id: ORG_A }]);
      mockExecute([
        {
          id: ROW_ID_BAM,
          source_app: 'bam',
          entity_type: 'bam.task',
          entity_id: ENTITY_ID,
          project_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          organization_id: null,
          actor_id: USER_TARGET_SAME_ORG,
          actor_type: 'human',
          action: 'task.create',
          details: null,
          created_at: new Date('2026-04-18T10:00:00Z'),
        },
      ]);
      const res = await app.inject({
        method: 'GET',
        url: `/v1/activity/unified/by-actor?actor_id=${USER_TARGET_SAME_ORG}`,
        headers: { 'x-test-user': 'human' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].actor_id).toBe(USER_TARGET_SAME_ORG);
    });
  });
});
