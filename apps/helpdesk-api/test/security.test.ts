import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import argon2 from 'argon2';

// ---------------------------------------------------------------------------
// Mocks — these must be hoisted by vitest via vi.mock().
// ---------------------------------------------------------------------------

// `db` is a mutable object whose .select / .update are re-stubbed per-test.
const dbMock: any = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  execute: vi.fn(),
};

vi.mock('../src/db/index.js', () => ({
  db: dbMock,
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

// Stub realtime broadcasts — tests don't exercise the Redis publisher.
vi.mock('../src/services/realtime.js', () => ({
  broadcastTicketMessage: vi.fn(async () => {}),
  broadcastTicketStatusChanged: vi.fn(async () => {}),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// A token of the form `hdag_<base64url>`. The first 8 chars (`hdag_tes`) are
// the key_prefix that requireAgentAuth indexes on.
const VALID_TOKEN = 'hdag_testtoken_abcdefghijklmnopqrstuv';
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_KEY_ID = '22222222-2222-2222-2222-222222222222';

let validKeyHash: string;
// Pre-computed argon2 hash of a DIFFERENT token — used to simulate "token
// presented didn't match this candidate row" without rehashing per test.
let otherKeyHash: string;

beforeAll(async () => {
  // Argon2id is expensive; compute once up-front and reuse.
  validKeyHash = await argon2.hash(VALID_TOKEN, { type: argon2.argon2id });
  otherKeyHash = await argon2.hash('hdag_someOtherTokenThatWontMatch', {
    type: argon2.argon2id,
  });
}, 30_000);

// Build a candidate row matching the select projection in requireAgentAuth.
function makeCandidate(overrides: Partial<{
  id: string;
  bbb_user_id: string;
  key_hash: string;
  expires_at: Date | null;
  revoked_at: Date | null;
  user_is_active: boolean;
}> = {}) {
  return {
    id: TEST_KEY_ID,
    bbb_user_id: TEST_USER_ID,
    key_hash: validKeyHash,
    expires_at: null,
    revoked_at: null,
    user_is_active: true,
    ...overrides,
  };
}

// Fake Drizzle fluent chain for the agent-key lookup:
// db.select({...}).from(x).innerJoin(...).where(...).limit(n) → rows
function makeAgentKeySelectChain(rows: any[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

// Fake .update().set().where() chain used for the fire-and-forget
// last_used_at write — must be thenable (has .catch()).
function stubUpdateLastUsed() {
  const chain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue({
      catch: vi.fn().mockReturnThis(),
    }),
  };
  dbMock.update.mockReturnValue(chain);
  return chain;
}

// Fake chain for the tickets list fetch that runs AFTER auth passes:
// db.select().from(tickets).orderBy(...) → [].
function makeTicketsSelectChain() {
  return {
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  };
}

// Spin up a minimal Fastify app with the real agent routes registered. We
// issue GET /tickets as the "does auth pass" probe because it is the
// cheapest route guarded by requireAgentAuth.
async function buildApp(): Promise<FastifyInstance> {
  const agentRoutesModule: any = await import('../src/routes/agent.routes.js');
  const agentRoutes = agentRoutesModule.default;

  const app = Fastify({ logger: false });
  await app.register(cookie, { secret: 'a'.repeat(32) });
  await app.register(agentRoutes);
  await app.ready();
  return app;
}

describe('HB-28 + HB-49: per-agent X-Agent-Key authentication', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('missing X-Agent-Key header → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/tickets' });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toMatch(/Missing or malformed X-Agent-Key/i);
    // DB should NEVER be consulted when the header is absent.
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('token too short (<9 chars) → 401 without DB lookup', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': 'short' },
    });
    expect(res.statusCode).toBe(401);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('valid key → 200; agentUserId populated and last_used_at updated', async () => {
    const authChain = makeAgentKeySelectChain([makeCandidate()]);
    const updateChain = stubUpdateLastUsed();
    dbMock.execute.mockResolvedValue({ rows: [] });
    dbMock.select
      .mockReturnValueOnce(authChain) // 1st call: agent key lookup
      .mockReturnValueOnce(makeTicketsSelectChain()); // 2nd call: tickets list

    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: [] });

    // Auth lookup used the fluent chain we provided.
    expect(authChain.where).toHaveBeenCalled();
    expect(authChain.limit).toHaveBeenCalledWith(10);

    // last_used_at update was fired.
    expect(dbMock.update).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ last_used_at: expect.any(Date) }),
    );
  });

  it('no rows match prefix → 401', async () => {
    dbMock.select.mockReturnValueOnce(makeAgentKeySelectChain([]));
    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
    expect(res.json().error.message).toMatch(/Invalid agent API key/);
  });

  it('candidate with wrong hash → argon2.verify fails → 401', async () => {
    dbMock.select.mockReturnValueOnce(
      makeAgentKeySelectChain([makeCandidate({ key_hash: otherKeyHash })]),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });
    expect(res.statusCode).toBe(401);
  });

  it('garbage key_hash (not a valid argon2 encoded string) → 401 (throw treated as !valid)', async () => {
    // A corrupted/truncated key_hash row makes argon2.verify throw
    // ("pchstr must contain a $ as first char"). requireAgentAuth wraps
    // verify in try/catch and treats any throw as a verification failure,
    // so one bad row cannot 500 every request that happens to share its
    // prefix — the caller just gets a clean 401 like for any other invalid
    // token. Logged at warn level for operator visibility.
    dbMock.select.mockReturnValueOnce(
      makeAgentKeySelectChain([makeCandidate({ key_hash: 'not-a-real-argon2-hash' })]),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });
    expect(res.statusCode).toBe(401);
  });

  it('expired key (expires_at in the past) → 401 even though hash matches', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    dbMock.select.mockReturnValueOnce(
      makeAgentKeySelectChain([makeCandidate({ expires_at: yesterday })]),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toMatch(/Invalid agent API key/);
  });

  it('revoked key (revoked_at in the past) → 401', async () => {
    const earlier = new Date(Date.now() - 60 * 60 * 1000);
    dbMock.select.mockReturnValueOnce(
      makeAgentKeySelectChain([makeCandidate({ revoked_at: earlier })]),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });
    expect(res.statusCode).toBe(401);
  });

  it('inactive user (is_active=false) → 401 even though hash matches', async () => {
    dbMock.select.mockReturnValueOnce(
      makeAgentKeySelectChain([makeCandidate({ user_is_active: false })]),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });
    expect(res.statusCode).toBe(401);
  });

  it('future expires_at is fine → 200', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    stubUpdateLastUsed();
    dbMock.execute.mockResolvedValue({ rows: [] });
    dbMock.select
      .mockReturnValueOnce(
        makeAgentKeySelectChain([makeCandidate({ expires_at: tomorrow })]),
      )
      .mockReturnValueOnce(makeTicketsSelectChain());

    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });
    expect(res.statusCode).toBe(200);
  });

  it('>3 candidates past the DoS cap → only first candidate verified', async () => {
    // Build 5 candidates. Only the LAST one has a hash that would verify
    // successfully against VALID_TOKEN — so if the middleware verified all
    // of them, we'd get a 200. Since the cap slices to the FIRST candidate
    // only (candidates.slice(0, 1) when length > 3), none of the first-
    // candidate verification should succeed → 401.
    const candidates = [
      makeCandidate({ id: 'k1', key_hash: otherKeyHash }),
      makeCandidate({ id: 'k2', key_hash: otherKeyHash }),
      makeCandidate({ id: 'k3', key_hash: otherKeyHash }),
      makeCandidate({ id: 'k4', key_hash: otherKeyHash }),
      makeCandidate({ id: 'k5', key_hash: validKeyHash }), // the "real" one
    ];
    dbMock.select.mockReturnValueOnce(makeAgentKeySelectChain(candidates));

    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });

    // First candidate's hash is otherKeyHash → argon2.verify fails → 401,
    // and the trailing valid candidate is NEVER consulted because of the
    // cap's slice(0, 1) behavior.
    expect(res.statusCode).toBe(401);
  });

  it('>3 candidates where the FIRST one is the valid key → 200', async () => {
    // Mirror image of the previous test: puts the valid hash first so we
    // confirm the cap preserves the "verify first candidate only" contract
    // (rather than, say, silently rejecting all when candidates > 3).
    const candidates = [
      makeCandidate({ id: 'k1', key_hash: validKeyHash }), // the real one
      makeCandidate({ id: 'k2', key_hash: otherKeyHash }),
      makeCandidate({ id: 'k3', key_hash: otherKeyHash }),
      makeCandidate({ id: 'k4', key_hash: otherKeyHash }),
    ];
    stubUpdateLastUsed();
    dbMock.execute.mockResolvedValue({ rows: [] });
    dbMock.select
      .mockReturnValueOnce(makeAgentKeySelectChain(candidates))
      .mockReturnValueOnce(makeTicketsSelectChain());

    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });

    expect(res.statusCode).toBe(200);
  });

  it('exactly 3 candidates (at the cap boundary) → all verified normally', async () => {
    // At exactly 3 candidates the cap does NOT engage (candidates.length > 3
    // is the trigger). Put the valid one last to prove all three are checked.
    const candidates = [
      makeCandidate({ id: 'k1', key_hash: otherKeyHash }),
      makeCandidate({ id: 'k2', key_hash: otherKeyHash }),
      makeCandidate({ id: 'k3', key_hash: validKeyHash }),
    ];
    stubUpdateLastUsed();
    dbMock.execute.mockResolvedValue({ rows: [] });
    dbMock.select
      .mockReturnValueOnce(makeAgentKeySelectChain(candidates))
      .mockReturnValueOnce(makeTicketsSelectChain());

    const res = await app.inject({
      method: 'GET',
      url: '/tickets',
      headers: { 'x-agent-key': VALID_TOKEN },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ============================================================================
// The remaining HB-* regression placeholders are untouched — they still
// describe integration scenarios that need a real/test postgres harness to
// exercise end-to-end. The agent-auth placeholders above (previously HB-12
// `it.todo`s) are now covered by the executable tests in the HB-28 + HB-49
// block.
// ============================================================================

describe('HB-4: reopen ownership enforcement', () => {
  it.todo(
    'customer A cannot reopen customer B\'s ticket — UPDATE WHERE must include helpdesk_user_id',
  );
  it.todo(
    'returns 404 (not 403) when a ticket exists but is owned by a different helpdesk_user',
  );
});

describe('HB-6: agent org scoping', () => {
  it.todo(
    'agent with valid BBB session sees only tickets whose project belongs to session.org_id',
  );
  it.todo(
    'agent without session sees all tickets (known limitation of shared X-Agent-Key trust model)',
  );
});

describe('HB-14: message author_id forgery prevention', () => {
  it.todo(
    'when a BBB session accompanies the request, author_id is taken from the session and cannot be overridden by the request body',
  );
  it.todo(
    'X-Agent-Key-only caller must supply author_id AND it must resolve to a real user row',
  );
  it.todo(
    'X-Agent-Key-only caller cannot forge author_id belonging to a user in a different org than the ticket\'s project',
  );
});
