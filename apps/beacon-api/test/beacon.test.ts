import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module before importing services
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    execute: vi.fn(),
  },
  connection: { end: vi.fn() },
}));

// Mock env
vi.mock('../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 4004,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    S3_ENDPOINT: 'http://minio:9000',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin',
    S3_BUCKET: 'beacon-uploads',
    S3_REGION: 'us-east-1',
    QDRANT_URL: 'http://qdrant:6333',
    BBB_API_INTERNAL_URL: 'http://api:4000',
    COOKIE_SECURE: false,
  },
}));

// ---------------------------------------------------------------------------
// slugify — pure function, no DB dependency
// ---------------------------------------------------------------------------

describe('slugify', () => {
  let slugify: (title: string) => string;

  beforeEach(async () => {
    const mod = await import('../src/services/beacon.service.js');
    slugify = mod.slugify;
  });

  it('converts title to lowercase hyphenated slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips non-alphanumeric characters', () => {
    expect(slugify('Deploy to Prod! (v2)')).toBe('deploy-to-prod-v2');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('foo---bar')).toBe('foo-bar');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles unicode by stripping non-ascii', () => {
    expect(slugify('Caf\u00e9 Latt\u00e9')).toBe('caf-latt');
  });

  it('truncates to 200 characters', () => {
    const long = 'a'.repeat(300);
    expect(slugify(long).length).toBeLessThanOrEqual(200);
  });

  it('handles all-special-character input', () => {
    expect(slugify('!@#$%^&*()')).toBe('');
  });

  it('preserves numbers', () => {
    expect(slugify('Release 3.2.1')).toBe('release-3-2-1');
  });
});

// ---------------------------------------------------------------------------
// BeaconError
// ---------------------------------------------------------------------------

describe('BeaconError', () => {
  it('creates error with code and message', async () => {
    const { BeaconError } = await import('../src/services/beacon.service.js');
    const error = new BeaconError('NOT_FOUND', 'Beacon not found', 404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Beacon not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('BeaconError');
  });

  it('defaults to 400 status code', async () => {
    const { BeaconError } = await import('../src/services/beacon.service.js');
    const error = new BeaconError('VALIDATION', 'Bad data');
    expect(error.statusCode).toBe(400);
  });
});
