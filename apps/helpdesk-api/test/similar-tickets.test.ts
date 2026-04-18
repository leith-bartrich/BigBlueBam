import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB so we exercise the scoring + prior-decision branches without
// needing a real Postgres backend. similar-tickets.service.ts touches two
// select flows (source ticket + candidate pool) and one select for prior
// decisions, all via the chainable .from().innerJoin().where().limit() form.
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockSelect,
  },
  connection: { end: vi.fn() },
}));

vi.mock('../src/env.js', () => ({
  env: {
    PORT: 4001,
    DATABASE_URL: 'postgres://test:test@localhost/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    HELPDESK_URL: 'http://localhost:8080',
    CORS_ORIGIN: 'http://localhost:8080',
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    SESSION_TTL_SECONDS: 604800,
  },
}));

function chainable(result: unknown[]) {
  const obj: any = {};
  obj.then = (resolve: Function, reject?: Function) =>
    Promise.resolve(result).then(resolve as any, reject as any);
  obj.limit = vi.fn().mockReturnValue(obj);
  obj.from = vi.fn().mockReturnValue(obj);
  obj.where = vi.fn().mockReturnValue(obj);
  obj.orderBy = vi.fn().mockReturnValue(obj);
  obj.innerJoin = vi.fn().mockReturnValue(obj);
  obj.leftJoin = vi.fn().mockReturnValue(obj);
  return obj;
}

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const REQUESTER_ID = '00000000-0000-0000-0000-000000000050';
const TICKET_A = '00000000-0000-0000-0000-0000000000aa';
const TICKET_B = '00000000-0000-0000-0000-0000000000bb';
const TICKET_C = '00000000-0000-0000-0000-0000000000cc';
const PROJECT_ID = '00000000-0000-0000-0000-000000000020';

beforeEach(() => {
  mockSelect.mockReset();
});

describe('helpdesk similar-tickets service', () => {
  it('throws 404 when source ticket is missing / out of org', async () => {
    const { findSimilarTickets, SimilarTicketsError } = await import(
      '../src/services/similar-tickets.service.js'
    );
    mockSelect.mockReturnValueOnce(chainable([]));
    try {
      await findSimilarTickets({ ticket_id: TICKET_A, org_id: ORG_ID });
      expect.fail('expected SimilarTicketsError');
    } catch (err) {
      expect(err).toBeInstanceOf(SimilarTicketsError);
      expect((err as any).statusCode).toBe(404);
      expect((err as any).code).toBe('NOT_FOUND');
    }
  });

  it('returns empty candidates when source subject is empty', async () => {
    const { findSimilarTickets } = await import('../src/services/similar-tickets.service.js');
    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: TICKET_A,
          subject: '',
          category: 'billing',
          helpdesk_user_id: REQUESTER_ID,
          project_id: PROJECT_ID,
          duplicate_of: null,
          org_id: ORG_ID,
        },
      ]),
    );
    const result = await findSimilarTickets({ ticket_id: TICKET_A, org_id: ORG_ID });
    expect(result.candidates).toEqual([]);
  });

  it('ranks subject-trgm + same-requester higher than subject-only match', async () => {
    const { findSimilarTickets } = await import('../src/services/similar-tickets.service.js');

    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: TICKET_A,
          subject: 'Login page is not loading',
          category: 'auth',
          helpdesk_user_id: REQUESTER_ID,
          project_id: PROJECT_ID,
          duplicate_of: null,
          org_id: ORG_ID,
        },
      ]),
    );

    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: TICKET_B,
          ticket_number: 101,
          subject: 'Login page is not loading',
          status: 'open',
          category: 'auth',
          helpdesk_user_id: REQUESTER_ID,
          duplicate_of: null,
          subject_sim: 0.9,
        },
        {
          id: TICKET_C,
          ticket_number: 102,
          subject: 'Login page loading slow',
          status: 'open',
          category: 'perf',
          helpdesk_user_id: '00000000-0000-0000-0000-000000000099',
          duplicate_of: null,
          subject_sim: 0.5,
        },
      ]),
    );

    // Prior decisions empty.
    mockSelect.mockReturnValueOnce(chainable([]));

    const result = await findSimilarTickets({
      ticket_id: TICKET_A,
      org_id: ORG_ID,
      min_confidence: 0,
    });
    expect(result.candidates).toHaveLength(2);
    // B has same requester + same category + high trgm -> ranks first.
    expect(result.candidates[0]!.ticket_id).toBe(TICKET_B);
    const bSignals = result.candidates[0]!.similarity_signals.map((s) => s.kind);
    expect(bSignals).toContain('subject_trgm');
    expect(bSignals).toContain('same_requester');
    expect(bSignals).toContain('same_category');
    // C only matches subject.
    expect(result.candidates[1]!.ticket_id).toBe(TICKET_C);
    expect(result.candidates[0]!.confidence).toBeGreaterThan(result.candidates[1]!.confidence);
  });

  it('surfaces prior_decision when a dedupe row exists for the pair', async () => {
    const { findSimilarTickets } = await import('../src/services/similar-tickets.service.js');

    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: TICKET_A,
          subject: 'SSO redirect loop',
          category: 'auth',
          helpdesk_user_id: REQUESTER_ID,
          project_id: PROJECT_ID,
          duplicate_of: null,
          org_id: ORG_ID,
        },
      ]),
    );

    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: TICKET_B,
          ticket_number: 202,
          subject: 'SSO redirect loop again',
          status: 'open',
          category: 'auth',
          helpdesk_user_id: REQUESTER_ID,
          duplicate_of: null,
          subject_sim: 0.85,
        },
      ]),
    );

    const [idA, idB] = TICKET_A < TICKET_B ? [TICKET_A, TICKET_B] : [TICKET_B, TICKET_A];
    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id_a: idA,
          id_b: idB,
          decision: 'not_duplicate',
          decided_at: new Date('2026-03-15T00:00:00Z'),
          decided_by: USER_ID,
          reason: 'different tenants',
          resurface_after: null,
        },
      ]),
    );

    const result = await findSimilarTickets({
      ticket_id: TICKET_A,
      org_id: ORG_ID,
      min_confidence: 0,
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.prior_decision).toBeDefined();
    expect(result.candidates[0]!.prior_decision?.decision).toBe('not_duplicate');
    expect(result.candidates[0]!.prior_decision?.reason).toBe('different tenants');
  });
});
