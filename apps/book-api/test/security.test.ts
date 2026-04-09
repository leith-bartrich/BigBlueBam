import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
  connection: { end: vi.fn() },
}));

vi.mock('../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 4012,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    BBB_API_INTERNAL_URL: 'http://api:4000',
    PUBLIC_URL: 'http://localhost',
    COOKIE_SECURE: false,
  },
}));

// ---------------------------------------------------------------------------
// BookError utility tests
// ---------------------------------------------------------------------------

describe('BookError utility', () => {
  let notFound: Function;
  let badRequest: Function;
  let conflict: Function;
  let forbidden: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/lib/utils.js');
    notFound = mod.notFound;
    badRequest = mod.badRequest;
    conflict = mod.conflict;
    forbidden = mod.forbidden;
  });

  it('notFound should return 404 with correct code', () => {
    const err = notFound('Calendar not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Calendar not found');
    expect(err.name).toBe('BookError');
  });

  it('badRequest should return 400 with correct code', () => {
    const err = badRequest('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('conflict should return 409 with correct code', () => {
    const err = conflict('Slug already in use');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('forbidden should return 403 with correct code', () => {
    const err = forbidden('Not allowed');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// escapeLike utility tests
// ---------------------------------------------------------------------------

describe('escapeLike', () => {
  let escapeLike: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/lib/utils.js');
    escapeLike = mod.escapeLike;
  });

  it('should escape % characters', () => {
    expect(escapeLike('50%')).toBe('50\\%');
  });

  it('should escape _ characters', () => {
    expect(escapeLike('test_value')).toBe('test\\_value');
  });

  it('should pass through normal strings', () => {
    expect(escapeLike('hello world')).toBe('hello world');
  });
});
