import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- hoisted mocks ----------
const { mockExecute, mockSelect, mockPreflight } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockSelect: vi.fn(),
  mockPreflight: vi.fn(),
}));

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
  db: {
    execute: mockExecute,
    select: mockSelect,
  },
  connection: { end: vi.fn() },
}));

vi.mock('../src/services/visibility.service.js', () => ({
  preflightAccess: mockPreflight,
  SUPPORTED_ENTITY_TYPES: [],
}));

import {
  expertiseForTopic,
  decayFactor,
  __test__,
  DEFAULT_WEIGHTS,
  DEFAULT_HALF_LIFE_DAYS,
  ExpertiseError,
} from '../src/services/expertise.service.js';

const ORG = '11111111-1111-1111-1111-111111111111';
const ASKER = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_A = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_B = 'cccccccc-0000-0000-0000-000000000003';

beforeEach(() => {
  mockExecute.mockReset();
  mockSelect.mockReset();
  mockPreflight.mockReset();
});

/**
 * Chainable stub for db.select().from().where(). Returns the given rows.
 */
function chainSelect(rows: unknown[]) {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  chain.limit = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('decayFactor', () => {
  it('returns 1.0 for now', () => {
    const now = new Date();
    expect(decayFactor(now, now, 90)).toBe(1);
  });

  it('returns 0.5 at one half-life', () => {
    const now = new Date('2026-04-18T00:00:00Z');
    const then = new Date('2026-01-18T00:00:00Z'); // 90 days earlier
    const f = decayFactor(then, now, 90);
    expect(f).toBeGreaterThan(0.499);
    expect(f).toBeLessThan(0.501);
  });

  it('returns 0.25 at two half-lives', () => {
    const now = new Date('2026-04-18T00:00:00Z');
    const then = new Date('2025-10-20T00:00:00Z'); // 180 days earlier (approx)
    const f = decayFactor(then, now, 90);
    expect(f).toBeLessThan(0.26);
    expect(f).toBeGreaterThan(0.24);
  });

  it('clamps future timestamps to 1.0', () => {
    const now = new Date('2026-04-18T00:00:00Z');
    const future = new Date('2026-05-01T00:00:00Z');
    expect(decayFactor(future, now, 90)).toBe(1);
  });

  it('returns 1.0 when half-life is <= 0 (treated as no decay)', () => {
    const now = new Date('2026-04-18T00:00:00Z');
    const then = new Date('2020-01-01T00:00:00Z');
    expect(decayFactor(then, now, 0)).toBe(1);
    expect(decayFactor(then, now, -5)).toBe(1);
  });
});

describe('resolveWeights', () => {
  it('returns defaults when input is undefined', () => {
    expect(__test__.resolveWeights(undefined)).toEqual(DEFAULT_WEIGHTS);
  });

  it('merges overrides with defaults', () => {
    const w = __test__.resolveWeights({ beacon: 5 });
    expect(w.beacon).toBe(5);
    expect(w.bam).toBe(DEFAULT_WEIGHTS.bam);
    expect(w.brief).toBe(DEFAULT_WEIGHTS.brief);
    expect(w.bond).toBe(DEFAULT_WEIGHTS.bond);
  });

  it('clamps negative weights to 0', () => {
    const w = __test__.resolveWeights({ bam: -10 });
    expect(w.bam).toBe(0);
  });

  it('falls back on non-finite input', () => {
    const w = __test__.resolveWeights({ bam: Number.NaN, brief: Infinity });
    expect(w.bam).toBe(DEFAULT_WEIGHTS.bam);
    expect(w.brief).toBe(DEFAULT_WEIGHTS.brief);
  });
});

describe('clampLimit', () => {
  it('defaults to 10', () => {
    expect(__test__.clampLimit(undefined)).toBe(10);
  });
  it('caps at 50', () => {
    expect(__test__.clampLimit(200)).toBe(50);
  });
  it('treats non-positive as default', () => {
    expect(__test__.clampLimit(0)).toBe(10);
    expect(__test__.clampLimit(-5)).toBe(10);
  });
});

describe('expertiseForTopic', () => {
  const now = new Date('2026-04-18T00:00:00Z');
  const recent = new Date('2026-04-17T00:00:00Z'); // ~1 day ago

  function setupHappyPath() {
    // Four per-source fetches, in order:
    //   beacon -> bam -> brief -> bond (two execute calls: deal + contact)
    // Then the users hydration .select().from().where() chain.
    mockExecute
      .mockResolvedValueOnce([
        { id: 'ee0', title: 'Login Flow', owned_by: USER_A, updated_at: recent },
      ])
      .mockResolvedValueOnce([
        { id: 't0', title: 'fix login', assignee_id: USER_A, updated_at: recent },
      ])
      .mockResolvedValueOnce([
        { id: 'd0', title: 'login SDK', created_by: USER_B, updated_at: recent },
      ])
      .mockResolvedValueOnce([]) // bond_deals
      .mockResolvedValueOnce([]); // bond_contacts
    mockSelect.mockReturnValue(
      chainSelect([
        { id: USER_A, email: 'alice@example.com', display_name: 'Alice' },
        { id: USER_B, email: 'bob@example.com', display_name: 'Bob' },
      ]),
    );
    // Default: every preflight allowed.
    mockPreflight.mockResolvedValue({ allowed: true, reason: 'ok' });
  }

  it('rejects empty topic', async () => {
    await expect(
      expertiseForTopic({ topic_query: '', asker_user_id: ASKER, org_id: ORG }),
    ).rejects.toThrow(ExpertiseError);
  });

  it('rejects missing asker', async () => {
    await expect(
      expertiseForTopic({ topic_query: 'x', asker_user_id: '', org_id: ORG }),
    ).rejects.toThrow(/asker_user_id is required/);
  });

  it('rejects missing org', async () => {
    await expect(
      expertiseForTopic({ topic_query: 'x', asker_user_id: ASKER, org_id: '' }),
    ).rejects.toThrow(/org_id is required/);
  });

  it('aggregates signals across sources and weights them correctly', async () => {
    setupHappyPath();
    const res = await expertiseForTopic({
      topic_query: 'login',
      asker_user_id: ASKER,
      org_id: ORG,
      now,
    });
    expect(res.topic).toBe('login');
    // Alice gets beacon(3.0) + bam(1.0) ~= 4.0 (minor decay at 1 day).
    // Bob gets brief(2.0) ~= 2.0.
    expect(res.experts.length).toBeGreaterThanOrEqual(2);
    const alice = res.experts.find((e) => e.user_id === USER_A);
    const bob = res.experts.find((e) => e.user_id === USER_B);
    expect(alice).toBeTruthy();
    expect(bob).toBeTruthy();
    expect(alice!.score).toBeGreaterThan(bob!.score);
    // Alice has beacon + bam signals; Bob has brief.
    const aliceSources = alice!.signals.map((s) => s.source).sort();
    expect(aliceSources).toEqual(['bam', 'beacon']);
    expect(bob!.signals[0]!.source).toBe('brief');
  });

  it('respects custom signal weights overrides', async () => {
    setupHappyPath();
    // Give bam a massive boost so Alice (bam-dominant when beacon is zeroed)
    // still ranks at the top, and zero beacon so we can see the override bite.
    const res = await expertiseForTopic({
      topic_query: 'login',
      asker_user_id: ASKER,
      org_id: ORG,
      now,
      signal_weights: { beacon: 0, bam: 100, brief: 1 },
    });
    const alice = res.experts.find((e) => e.user_id === USER_A)!;
    const beaconSig = alice.signals.find((s) => s.source === 'beacon');
    expect(beaconSig).toBeUndefined();
    const bamSig = alice.signals.find((s) => s.source === 'bam');
    expect(bamSig).toBeTruthy();
    expect(bamSig!.weight).toBe(100);
  });

  it('strips evidence that preflightAccess denies but keeps the score', async () => {
    setupHappyPath();
    // Deny the one beacon evidence row for Alice.
    mockPreflight.mockImplementation(
      async (_asker: string, entityType: string) => ({
        allowed: entityType !== 'beacon.entry',
        reason: entityType === 'beacon.entry' ? 'beacon_private_not_owner' : 'ok',
      }),
    );
    const res = await expertiseForTopic({
      topic_query: 'login',
      asker_user_id: ASKER,
      org_id: ORG,
      now,
    });
    const alice = res.experts.find((e) => e.user_id === USER_A)!;
    const beaconSig = alice.signals.find((s) => s.source === 'beacon');
    // Score still includes the beacon contribution, but the evidence array
    // for that source is empty.
    expect(beaconSig).toBeTruthy();
    expect(beaconSig!.evidence).toEqual([]);
    expect(alice.score).toBeGreaterThan(0);
  });

  it('time-decay half-life dampens older signals', async () => {
    // Two users: alice has a fresh beacon entry, bob has a year-old one.
    // With default 90-day half-life, alice should outrank bob even though
    // their raw weight counts are the same.
    const veryOld = new Date('2025-04-17T00:00:00Z'); // ~366 days ago
    mockExecute
      .mockResolvedValueOnce([
        { id: 'fresh', title: 'login', owned_by: USER_A, updated_at: recent },
        { id: 'old', title: 'login', owned_by: USER_B, updated_at: veryOld },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockSelect.mockReturnValue(
      chainSelect([
        { id: USER_A, email: 'a@x', display_name: 'Alice' },
        { id: USER_B, email: 'b@x', display_name: 'Bob' },
      ]),
    );
    mockPreflight.mockResolvedValue({ allowed: true, reason: 'ok' });
    const res = await expertiseForTopic({
      topic_query: 'login',
      asker_user_id: ASKER,
      org_id: ORG,
      now,
    });
    expect(res.experts[0]!.user_id).toBe(USER_A);
    expect(res.experts[1]!.user_id).toBe(USER_B);
    expect(res.experts[0]!.score).toBeGreaterThan(res.experts[1]!.score * 10);
  });

  it('uses default half-life when not supplied', async () => {
    setupHappyPath();
    const res = await expertiseForTopic({
      topic_query: 'login',
      asker_user_id: ASKER,
      org_id: ORG,
      now,
    });
    expect(res.experts.length).toBeGreaterThan(0);
    // Cannot introspect the half-life from output; assert the default const
    // is 90 as documented.
    expect(DEFAULT_HALF_LIFE_DAYS).toBe(90);
  });

  it('honors custom half-life', async () => {
    // With a 1-day half-life, a ~1-day-old signal decays to ~0.5. A recent
    // signal at the same timestamp gives ~0.5x the raw weight.
    setupHappyPath();
    const res = await expertiseForTopic({
      topic_query: 'login',
      asker_user_id: ASKER,
      org_id: ORG,
      now,
      time_decay_half_life_days: 1,
    });
    const alice = res.experts.find((e) => e.user_id === USER_A)!;
    // beacon(3) + bam(1) = 4; at ~1-day decay, expected ~2.
    expect(alice.score).toBeGreaterThan(1.5);
    expect(alice.score).toBeLessThan(3);
  });

  it('returns empty experts when no signals match', async () => {
    mockExecute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await expertiseForTopic({
      topic_query: 'nonexistent',
      asker_user_id: ASKER,
      org_id: ORG,
      now,
    });
    expect(res.experts).toEqual([]);
  });

  it('degrades gracefully when a source query rejects', async () => {
    // First execute (beacon) rejects; the remainder succeed.
    mockExecute
      .mockRejectedValueOnce(new Error('pg timeout'))
      .mockResolvedValueOnce([
        { id: 't0', title: 'login', assignee_id: USER_A, updated_at: recent },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockSelect.mockReturnValue(
      chainSelect([{ id: USER_A, email: 'a@x', display_name: 'Alice' }]),
    );
    mockPreflight.mockResolvedValue({ allowed: true, reason: 'ok' });
    const res = await expertiseForTopic({
      topic_query: 'login',
      asker_user_id: ASKER,
      org_id: ORG,
      now,
    });
    const alice = res.experts.find((e) => e.user_id === USER_A);
    expect(alice).toBeTruthy();
    // No beacon signal because that arm threw.
    expect(alice!.signals.find((s) => s.source === 'beacon')).toBeUndefined();
    expect(alice!.signals.find((s) => s.source === 'bam')).toBeTruthy();
  });

  it('clamps limit to at most 50', async () => {
    setupHappyPath();
    const res = await expertiseForTopic({
      topic_query: 'login',
      asker_user_id: ASKER,
      org_id: ORG,
      limit: 999,
      now,
    });
    expect(res.experts.length).toBeLessThanOrEqual(50);
  });
});
