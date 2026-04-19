import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the database module
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
    NODE_ENV: 'test',
    PORT: 4009,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    BBB_API_INTERNAL_URL: 'http://api:4000',
    COOKIE_SECURE: false,
    PUBLIC_URL: 'http://localhost',
  },
}));

// ---------------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------------

function chainable(result: unknown[]) {
  const obj: any = {};
  obj.then = (resolve: Function, reject?: Function) =>
    Promise.resolve(result).then(resolve as any, reject as any);
  obj.limit = vi.fn().mockReturnValue(obj);
  obj.offset = vi.fn().mockReturnValue(obj);
  obj.from = vi.fn().mockReturnValue(obj);
  obj.where = vi.fn().mockReturnValue(obj);
  obj.orderBy = vi.fn().mockReturnValue(obj);
  obj.innerJoin = vi.fn().mockReturnValue(obj);
  return obj;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const CONTACT_A = '00000000-0000-0000-0000-0000000000aa';
const CONTACT_B = '00000000-0000-0000-0000-0000000000bb';
const CONTACT_C = '00000000-0000-0000-0000-0000000000cc';

beforeEach(() => {
  mockSelect.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bond dedupe service', () => {
  it('throws 404 when source contact is missing / out of org', async () => {
    const { findDuplicateContacts } = await import('../src/services/dedupe.service.js');
    // Source-contact lookup returns empty.
    mockSelect.mockReturnValueOnce(chainable([]));
    await expect(
      findDuplicateContacts({ contact_id: CONTACT_A, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('returns empty candidates when source has no identifying fields', async () => {
    const { findDuplicateContacts } = await import('../src/services/dedupe.service.js');
    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: CONTACT_A,
          first_name: null,
          last_name: null,
          email: null,
          phone: null,
          organization_id: ORG_ID,
        },
      ]),
    );
    const result = await findDuplicateContacts({ contact_id: CONTACT_A, org_id: ORG_ID });
    expect(result.source_contact_id).toBe(CONTACT_A);
    expect(result.candidates).toEqual([]);
  });

  it('ranks email-exact higher than name-only match and enriches prior_decision', async () => {
    const { findDuplicateContacts } = await import('../src/services/dedupe.service.js');

    // Source contact.
    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: CONTACT_A,
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          phone: '+1-555-0100',
          organization_id: ORG_ID,
        },
      ]),
    );

    // Candidate pool with two matches.
    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: CONTACT_B,
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          phone: null,
          name_sim: 1.0,
        },
        {
          id: CONTACT_C,
          first_name: 'Ada',
          last_name: 'Byron',
          email: null,
          phone: null,
          name_sim: 0.6,
        },
      ]),
    );

    // Prior decisions for the ordered pair.
    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id_a: CONTACT_A < CONTACT_B ? CONTACT_A : CONTACT_B,
          id_b: CONTACT_A < CONTACT_B ? CONTACT_B : CONTACT_A,
          decision: 'not_duplicate',
          decided_at: new Date('2026-04-01T00:00:00Z'),
          decided_by: USER_ID,
          reason: 'different people',
          resurface_after: null,
        },
      ]),
    );

    const result = await findDuplicateContacts({
      contact_id: CONTACT_A,
      org_id: ORG_ID,
      min_confidence: 0,
    });
    expect(result.source_contact_id).toBe(CONTACT_A);
    expect(result.candidates).toHaveLength(2);
    // Email-exact match ranks first.
    expect(result.candidates[0]!.contact_id).toBe(CONTACT_B);
    expect(result.candidates[0]!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.candidates[0]!.signals.some((s) => s.kind === 'email_exact')).toBe(true);
    expect(result.candidates[0]!.prior_decision?.decision).toBe('not_duplicate');
    // Second candidate is name-only and has no prior decision.
    expect(result.candidates[1]!.contact_id).toBe(CONTACT_C);
    expect(result.candidates[1]!.prior_decision).toBeUndefined();
  });

  it('filters candidates below min_confidence', async () => {
    const { findDuplicateContacts } = await import('../src/services/dedupe.service.js');

    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: CONTACT_A,
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: null,
          phone: null,
          organization_id: ORG_ID,
        },
      ]),
    );
    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: CONTACT_B,
          first_name: 'Ava',
          last_name: 'Love',
          email: null,
          phone: null,
          name_sim: 0.18,
        },
      ]),
    );

    const result = await findDuplicateContacts({
      contact_id: CONTACT_A,
      org_id: ORG_ID,
      min_confidence: 0.5,
    });
    expect(result.candidates).toEqual([]);
  });

  it('normalizes phone and matches across formatting differences', async () => {
    const { findDuplicateContacts } = await import('../src/services/dedupe.service.js');

    // normalizePhone strips non-digits only (no country-code canonicalization),
    // so the two phone strings must reduce to the same digit sequence. Both
    // drop down to '15550100100' after \D stripping.
    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: CONTACT_A,
          first_name: null,
          last_name: null,
          email: null,
          phone: '+1 (555) 010-0100',
          organization_id: ORG_ID,
        },
      ]),
    );
    mockSelect.mockReturnValueOnce(
      chainable([
        {
          id: CONTACT_B,
          first_name: null,
          last_name: null,
          email: null,
          phone: '1-555-010-0100',
          name_sim: 0,
        },
      ]),
    );
    mockSelect.mockReturnValueOnce(chainable([]));

    const result = await findDuplicateContacts({
      contact_id: CONTACT_A,
      org_id: ORG_ID,
      min_confidence: 0,
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.signals.some((s) => s.kind === 'phone_exact')).toBe(true);
  });
});
