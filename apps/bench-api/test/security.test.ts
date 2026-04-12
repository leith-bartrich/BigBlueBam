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

const ORG_ID = '00000000-0000-0000-0000-000000000001';

describe('Query Security', () => {
  it('rejects identifiers with spaces', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    expect(() =>
      buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: 'id name', agg: 'count' }],
        },
        ORG_ID,
      ),
    ).toThrow('Invalid identifier');
  });

  it('rejects identifiers with semicolons', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    expect(() =>
      buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: 'id;', agg: 'count' }],
        },
        ORG_ID,
      ),
    ).toThrow('Invalid identifier');
  });

  it('rejects identifiers starting with numbers', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    expect(() =>
      buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: '1invalid', agg: 'count' }],
        },
        ORG_ID,
      ),
    ).toThrow('Invalid identifier');
  });

  it('parameterizes filter values containing single quotes', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    const pq = buildQuery(
      'bam',
      'tasks',
      {
        measures: [{ field: 'id', agg: 'count' }],
        filters: [{ field: 'state', op: 'eq', value: "it's" }],
      },
      ORG_ID,
    );

    // Value must be carried as a positional parameter, never inlined into SQL.
    expect(pq.text).toMatch(/state = \$\d+/);
    expect(pq.text).not.toContain("it's");
    expect(pq.params).toContain("it's");
  });

  it('builds IN filter with array values as parameters', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    const pq = buildQuery(
      'bam',
      'tasks',
      {
        measures: [{ field: 'id', agg: 'count' }],
        filters: [{ field: 'priority', op: 'in', value: ['high', 'critical'] }],
      },
      ORG_ID,
    );

    expect(pq.text).toMatch(/priority IN \(\$\d+, \$\d+\)/);
    expect(pq.params).toContain('high');
    expect(pq.params).toContain('critical');
  });

  it('rejects IN filter with non-array value', async () => {
    const { buildQuery } = await import('../src/services/query.service.js');
    expect(() =>
      buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: 'id', agg: 'count' }],
          filters: [{ field: 'priority', op: 'in', value: 'high' }],
        },
        ORG_ID,
      ),
    ).toThrow('IN filter requires an array value');
  });
});
