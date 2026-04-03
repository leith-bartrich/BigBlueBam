import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Worker env validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadEnvFresh() {
    const mod = await import('../src/env.js');
    return mod.loadEnv;
  }

  it('parses valid env correctly', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.WORKER_CONCURRENCY).toBe(5);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('fails validation when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    process.env.REDIS_URL = 'redis://localhost:6379';

    const loadEnv = await loadEnvFresh();

    expect(() => loadEnv()).toThrow('Invalid environment variables');
  });

  it('uses default when REDIS_URL is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    delete process.env.REDIS_URL;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('defaults WORKER_CONCURRENCY to 5', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    delete process.env.WORKER_CONCURRENCY;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.WORKER_CONCURRENCY).toBe(5);
  });

  it('overrides WORKER_CONCURRENCY when provided', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.WORKER_CONCURRENCY = '10';

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.WORKER_CONCURRENCY).toBe(10);
  });

  it('defaults LOG_LEVEL to info', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    delete process.env.LOG_LEVEL;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.LOG_LEVEL).toBe('info');
  });

  it('accepts valid LOG_LEVEL values', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.LOG_LEVEL = 'debug';

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.LOG_LEVEL).toBe('debug');
  });

  it('coerces SMTP_PORT to number', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.SMTP_PORT = '465';

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.SMTP_PORT).toBe(465);
  });
});
