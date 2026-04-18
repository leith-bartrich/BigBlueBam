import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB so we can drive upsertHelpdeskUserByEmail's branches without a
// real Postgres backend. The service touches exactly three patterns:
//   1. db.select().from().where().limit() — the existing-row pre-check
//   2. db.update().set().where().returning() — update path
//   3. db.insert().values().onConflictDoUpdate().returning() — insert path
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: vi.fn(),
    transaction: vi.fn(),
    execute: vi.fn(),
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
    LOG_LEVEL: 'info',
    SESSION_TTL_SECONDS: 604800,
  },
}));

// argon2 is slow in tests; stub it so we exercise the logical branches fast.
// We assert that the insert path DID hash a password (non-empty hash call)
// and that the update path NEVER called argon2.hash (per the security
// contract in user-upsert.service.ts).
const argon2Hash = vi.fn().mockResolvedValue('$argon2id$mocked');
vi.mock('argon2', () => ({
  default: { hash: argon2Hash, verify: vi.fn().mockResolvedValue(true) },
  hash: argon2Hash,
  verify: vi.fn().mockResolvedValue(true),
}));

function chainable(result: unknown[]) {
  const obj: any = {};
  obj.then = (resolve: Function, reject?: Function) =>
    Promise.resolve(result).then(resolve as any, reject as any);
  obj.limit = vi.fn().mockReturnValue(obj);
  obj.returning = vi.fn().mockResolvedValue(result);
  obj.from = vi.fn().mockReturnValue(obj);
  obj.where = vi.fn().mockReturnValue(obj);
  obj.orderBy = vi.fn().mockReturnValue(obj);
  obj.set = vi.fn().mockReturnValue(obj);
  obj.values = vi.fn().mockReturnValue(obj);
  obj.onConflictDoUpdate = vi.fn().mockReturnValue(obj);
  return obj;
}

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000050';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    org_id: ORG_ID,
    email: 'jane@acme.com',
    display_name: 'Jane',
    password_hash: '$argon2id$existing',
    email_verified: false,
    email_verification_token: null,
    email_verification_token_hash: null,
    email_verification_sent_at: null,
    is_active: true,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

describe('upsertHelpdeskUserByEmail — validation', () => {
  let upsertHelpdeskUserByEmail: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/user-upsert.service.js');
    upsertHelpdeskUserByEmail = mod.upsertHelpdeskUserByEmail;
  });

  it('rejects missing email', async () => {
    await expect(
      upsertHelpdeskUserByEmail({ email: '', display_name: 'Jane' }, ORG_ID),
    ).rejects.toThrow(/email/);
  });

  it('rejects missing display_name', async () => {
    await expect(
      upsertHelpdeskUserByEmail({ email: 'j@a.co', display_name: '' }, ORG_ID),
    ).rejects.toThrow(/display_name/);
  });
});

describe('upsertHelpdeskUserByEmail — create path', () => {
  let upsertHelpdeskUserByEmail: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/user-upsert.service.js');
    upsertHelpdeskUserByEmail = mod.upsertHelpdeskUserByEmail;
  });

  it('returns created=true and hashes the supplied password', async () => {
    mockSelect.mockReturnValueOnce(chainable([])); // pre-check: empty
    mockInsert.mockReturnValueOnce(
      chainable([{ user: makeUser(), created: true }]),
    );

    const result = await upsertHelpdeskUserByEmail(
      { email: 'Jane@ACME.com', display_name: 'Jane', password: 'longenoughpassword' },
      ORG_ID,
    );

    expect(result.created).toBe(true);
    expect(result.idempotency_key).toBe('email:jane@acme.com');
    // Password must have been hashed on the insert path.
    expect(argon2Hash).toHaveBeenCalledTimes(1);
  });

  it('still generates a hash when no password is provided', async () => {
    mockSelect.mockReturnValueOnce(chainable([]));
    mockInsert.mockReturnValueOnce(
      chainable([{ user: makeUser({ email: 'bob@acme.com' }), created: true }]),
    );

    const result = await upsertHelpdeskUserByEmail(
      { email: 'bob@acme.com', display_name: 'Bob' },
      ORG_ID,
    );

    expect(result.created).toBe(true);
    // Row can't be logged into without a reset flow (random-nanoid hash).
    expect(argon2Hash).toHaveBeenCalledTimes(1);
  });
});

describe('upsertHelpdeskUserByEmail — update path', () => {
  let upsertHelpdeskUserByEmail: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/user-upsert.service.js');
    upsertHelpdeskUserByEmail = mod.upsertHelpdeskUserByEmail;
  });

  it('returns created=false and patches display_name', async () => {
    const existing = makeUser({ display_name: 'Old Name' });
    mockSelect.mockReturnValueOnce(chainable([existing]));
    mockUpdate.mockReturnValueOnce(
      chainable([{ ...existing, display_name: 'New Name' }]),
    );

    const result = await upsertHelpdeskUserByEmail(
      { email: 'jane@acme.com', display_name: 'New Name' },
      ORG_ID,
    );

    expect(result.created).toBe(false);
    expect(result.data.display_name).toBe('New Name');
    expect(result.idempotency_key).toBe('email:jane@acme.com');
  });

  it('IGNORES password on the update path (security contract)', async () => {
    const existing = makeUser({ password_hash: '$argon2id$original' });
    mockSelect.mockReturnValueOnce(chainable([existing]));
    mockUpdate.mockReturnValueOnce(
      chainable([{ ...existing, display_name: 'Jane Updated' }]),
    );

    const result = await upsertHelpdeskUserByEmail(
      {
        email: 'jane@acme.com',
        display_name: 'Jane Updated',
        // Even though password is provided, it MUST NOT be written.
        password: 'a-brand-new-password-supplied-by-attacker-webhook',
      },
      ORG_ID,
    );

    expect(result.created).toBe(false);
    // Critical assertion: no argon2.hash call on the update path.
    expect(argon2Hash).not.toHaveBeenCalled();
    // Returned row still carries the original hash (no password_hash in
    // the update set, so the DB side would not have touched it either).
    expect(result.data.password_hash).toBe('$argon2id$original');
  });
});
