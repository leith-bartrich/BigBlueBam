import { describe, it, expect, vi, beforeEach } from 'vitest';

// Drizzle-style chain mocking, same pattern as entity-links.test.ts.
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../src/env.js', () => ({
  env: {
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    SESSION_SECRET: 'a'.repeat(32),
    SESSION_TTL_SECONDS: 604800,
    NODE_ENV: 'test',
    PORT: 4000,
    HOST: '0.0.0.0',
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

const ORG_A = '11111111-1111-1111-1111-111111111111';
const HUMAN_USER = '22222222-2222-2222-2222-222222222222';
const AGENT_USER = '33333333-3333-3333-3333-333333333333';
const ENTITY_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ENTITY_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// select().from().where().limit() -> rows
function mockSelectLimit(rows: any[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  mockDb.select.mockReturnValueOnce({ from });
}

function mockInsertReturning(rows: any[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const values = vi.fn().mockReturnValue({ returning });
  mockDb.insert.mockReturnValueOnce({ values });
}

function mockUpdateReturning(rows: any[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  mockDb.update.mockReturnValueOnce({ set });
}

function existingRow(overrides: Partial<any> = {}) {
  // Canonical ordered pair enforced by the CHECK constraint in 0136.
  const [a, b] = ENTITY_A < ENTITY_B ? [ENTITY_A, ENTITY_B] : [ENTITY_B, ENTITY_A];
  return {
    id: '44444444-4444-4444-4444-444444444444',
    org_id: ORG_A,
    entity_type: 'bond.contact',
    id_a: a,
    id_b: b,
    decision: 'not_duplicate',
    decided_by: HUMAN_USER,
    decided_at: new Date('2026-04-01T00:00:00Z'),
    reason: 'different people',
    confidence_at_decision: null,
    resurface_after: null,
    created_at: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  };
}

describe('dedupe-decisions service: recordDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects id_a === id_b', async () => {
    const { recordDecision } = await import('../src/services/dedupe-decisions.service.js');
    const res = await recordDecision({
      org_id: ORG_A,
      actor_user_id: HUMAN_USER,
      entity_type: 'bond.contact',
      id_a: ENTITY_A,
      id_b: ENTITY_A,
      decision: 'not_duplicate',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('ORDERED_PAIR_EQUAL');
  });

  it('canonicalizes the pair so (A,B) and (B,A) both resolve the same row', async () => {
    const { recordDecision } = await import('../src/services/dedupe-decisions.service.js');
    // Actor kind lookup -> human.
    mockSelectLimit([{ kind: 'human' }]);
    // No existing row -> insert path.
    mockSelectLimit([]);
    const [idA, idB] = ENTITY_A < ENTITY_B ? [ENTITY_A, ENTITY_B] : [ENTITY_B, ENTITY_A];
    mockInsertReturning([
      existingRow({ id_a: idA, id_b: idB, decision: 'duplicate', decided_by: HUMAN_USER }),
    ]);

    // Call with REVERSED order intentionally.
    const res = await recordDecision({
      org_id: ORG_A,
      actor_user_id: HUMAN_USER,
      entity_type: 'bond.contact',
      // Pass the larger uuid first so the service must sort.
      id_a: idB,
      id_b: idA,
      decision: 'duplicate',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id_a < res.data.id_b).toBe(true);
      expect(res.data.id_a).toBe(idA);
      expect(res.data.id_b).toBe(idB);
    }
  });

  it('rejects agent overwriting a human decision with 409 HUMAN_DECISION_EXISTS', async () => {
    const { recordDecision } = await import('../src/services/dedupe-decisions.service.js');
    // Actor kind lookup -> agent.
    mockSelectLimit([{ kind: 'agent' }]);
    // Existing row found with a human decider.
    mockSelectLimit([existingRow({ decided_by: HUMAN_USER })]);
    // Prior-actor kind lookup (agent-path) -> human.
    mockSelectLimit([{ kind: 'human' }]);

    const res = await recordDecision({
      org_id: ORG_A,
      actor_user_id: AGENT_USER,
      entity_type: 'bond.contact',
      id_a: ENTITY_A,
      id_b: ENTITY_B,
      decision: 'duplicate',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('HUMAN_DECISION_EXISTS');
      expect(res.status).toBe(409);
      expect(res.prior_decision).toBeDefined();
      expect(res.prior_decision?.decided_by).toBe(HUMAN_USER);
    }
  });

  it('allows agent overwriting an earlier agent-recorded decision', async () => {
    const { recordDecision } = await import('../src/services/dedupe-decisions.service.js');
    mockSelectLimit([{ kind: 'agent' }]); // actor
    mockSelectLimit([existingRow({ decided_by: AGENT_USER })]); // existing
    mockSelectLimit([{ kind: 'agent' }]); // prior actor
    mockUpdateReturning([
      existingRow({ decision: 'needs_review', decided_by: AGENT_USER }),
    ]);

    const res = await recordDecision({
      org_id: ORG_A,
      actor_user_id: AGENT_USER,
      entity_type: 'bond.contact',
      id_a: ENTITY_A,
      id_b: ENTITY_B,
      decision: 'needs_review',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.created).toBe(false);
      expect(res.data.decision).toBe('needs_review');
    }
  });

  it('humans always overwrite prior decisions', async () => {
    const { recordDecision } = await import('../src/services/dedupe-decisions.service.js');
    mockSelectLimit([{ kind: 'human' }]); // actor human
    mockSelectLimit([existingRow({ decided_by: HUMAN_USER })]); // existing human row
    mockUpdateReturning([existingRow({ decision: 'duplicate' })]);

    const res = await recordDecision({
      org_id: ORG_A,
      actor_user_id: HUMAN_USER,
      entity_type: 'bond.contact',
      id_a: ENTITY_A,
      id_b: ENTITY_B,
      decision: 'duplicate',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.decision).toBe('duplicate');
  });
});

describe('dedupe-decisions service: canonical pair helper', () => {
  it('orders ids consistently regardless of input order', async () => {
    const { __test__ } = await import('../src/services/dedupe-decisions.service.js');
    const [a, b] = __test__.canonicalPair(ENTITY_B, ENTITY_A);
    expect(a < b).toBe(true);
    const [c, d] = __test__.canonicalPair(ENTITY_A, ENTITY_B);
    expect(c).toBe(a);
    expect(d).toBe(b);
  });
});
