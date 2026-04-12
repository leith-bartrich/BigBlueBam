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
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    BBB_API_INTERNAL_URL: 'http://api:4000',
    COOKIE_SECURE: false,
    QUERY_TIMEOUT_MS: 10000,
    CACHE_TTL_SECONDS: 60,
  },
}));

const ORG_ID = '00000000-0000-0000-0000-000000000001';

describe('Query Builder', () => {
  describe('buildQuery', () => {
    it('builds a simple count query', async () => {
      const { buildQuery } = await import('../src/services/query.service.js');
      const pq = buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: 'id', agg: 'count', alias: 'task_count' }],
        },
        ORG_ID,
      );

      expect(pq.text).toContain('SELECT');
      expect(pq.text).toContain('COUNT(id)');
      expect(pq.text).toContain('FROM tasks');
      expect(pq.text).toContain('LIMIT');
    });

    it('builds a grouped query with dimensions', async () => {
      const { buildQuery } = await import('../src/services/query.service.js');
      const pq = buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: 'id', agg: 'count', alias: 'task_count' }],
          dimensions: [{ field: 'priority' }],
        },
        ORG_ID,
      );

      expect(pq.text).toContain('priority');
      expect(pq.text).toContain('GROUP BY');
    });

    it('builds a query with filters', async () => {
      const { buildQuery } = await import('../src/services/query.service.js');
      const pq = buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: 'id', agg: 'count' }],
          filters: [{ field: 'state', op: 'eq', value: 'done' }],
        },
        ORG_ID,
      );

      // Filter values are now parameterized — verify the clause uses a placeholder
      // and that the value is carried in params.
      expect(pq.text).toMatch(/state = \$\d+/);
      expect(pq.params).toContain('done');
    });

    it('builds a time-bucketed query', async () => {
      const { buildQuery } = await import('../src/services/query.service.js');
      const pq = buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: 'id', agg: 'count' }],
          time_dimension: { field: 'created_at', granularity: 'week' },
        },
        ORG_ID,
      );

      expect(pq.text).toContain("date_trunc('week', created_at)");
      expect(pq.text).toContain('time_bucket');
    });

    it('rejects unknown data source', async () => {
      const { buildQuery } = await import('../src/services/query.service.js');
      expect(() =>
        buildQuery(
          'nonexistent',
          'fake',
          {
            measures: [{ field: 'id', agg: 'count' }],
          },
          ORG_ID,
        ),
      ).toThrow('Unknown data source');
    });

    it('rejects SQL injection in identifiers', async () => {
      const { buildQuery } = await import('../src/services/query.service.js');
      expect(() =>
        buildQuery(
          'bam',
          'tasks',
          {
            measures: [{ field: 'id; DROP TABLE tasks', agg: 'count' }],
          },
          ORG_ID,
        ),
      ).toThrow('Invalid identifier');
    });

    it('applies sort ordering', async () => {
      const { buildQuery } = await import('../src/services/query.service.js');
      const pq = buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: 'id', agg: 'count', alias: 'task_count' }],
          dimensions: [{ field: 'priority' }],
          sort: [{ field: 'task_count', dir: 'desc' }],
        },
        ORG_ID,
      );

      expect(pq.text).toContain('ORDER BY task_count DESC');
    });

    it('applies limit', async () => {
      const { buildQuery } = await import('../src/services/query.service.js');
      const pq = buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: 'id', agg: 'count' }],
          limit: 25,
        },
        ORG_ID,
      );

      expect(pq.text).toContain('LIMIT 25');
    });

    it('caps limit at 10000', async () => {
      const { buildQuery } = await import('../src/services/query.service.js');
      const pq = buildQuery(
        'bam',
        'tasks',
        {
          measures: [{ field: 'id', agg: 'count' }],
          limit: 50000,
        },
        ORG_ID,
      );

      expect(pq.text).toContain('LIMIT 10000');
    });
  });
});
