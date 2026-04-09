import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn() },
  readDb: { execute: vi.fn() },
  connection: { end: vi.fn() },
  readConnection: { end: vi.fn() },
}));

vi.mock('../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 4011,
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    QUERY_TIMEOUT_MS: 10000,
    CACHE_TTL_SECONDS: 60,
  },
}));

describe('Query Security', () => {
  it('rejects identifiers with spaces', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    expect(() =>
      buildQuery('bam', 'tasks', {
        measures: [{ field: 'id name', agg: 'count' }],
      }),
    ).toThrow('Invalid identifier');
  });

  it('rejects identifiers with semicolons', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    expect(() =>
      buildQuery('bam', 'tasks', {
        measures: [{ field: 'id;', agg: 'count' }],
      }),
    ).toThrow('Invalid identifier');
  });

  it('rejects identifiers starting with numbers', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    expect(() =>
      buildQuery('bam', 'tasks', {
        measures: [{ field: '1invalid', agg: 'count' }],
      }),
    ).toThrow('Invalid identifier');
  });

  it('escapes single quotes in filter values', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    const sql = buildQuery('bam', 'tasks', {
      measures: [{ field: 'id', agg: 'count' }],
      filters: [{ field: 'state', op: 'eq', value: "it's" }],
    });

    expect(sql).toContain("state = 'it''s'");
    expect(sql).not.toContain("it's'");
  });

  it('builds IN filter with array values', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    const sql = buildQuery('bam', 'tasks', {
      measures: [{ field: 'id', agg: 'count' }],
      filters: [{ field: 'priority', op: 'in', value: ['high', 'critical'] }],
    });

    expect(sql).toContain("priority IN ('high','critical')");
  });

  it('rejects IN filter with non-array value', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    expect(() =>
      buildQuery('bam', 'tasks', {
        measures: [{ field: 'id', agg: 'count' }],
        filters: [{ field: 'priority', op: 'in', value: 'high' }],
      }),
    ).toThrow('IN filter requires an array value');
  });
});
