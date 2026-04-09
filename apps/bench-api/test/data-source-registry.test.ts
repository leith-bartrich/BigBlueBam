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

describe('Data Source Registry', () => {
  it('lists all data sources', async () => {
    const { listDataSources } = await import('../src/lib/data-source-registry.js');
    const sources = listDataSources();

    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some((s) => s.product === 'bam')).toBe(true);
    expect(sources.some((s) => s.product === 'bond')).toBe(true);
    expect(sources.some((s) => s.product === 'blast')).toBe(true);
  });

  it('gets a specific data source', async () => {
    const { getDataSource } = await import('../src/lib/data-source-registry.js');
    const source = getDataSource('bam', 'tasks');

    expect(source).toBeDefined();
    expect(source!.product).toBe('bam');
    expect(source!.entity).toBe('tasks');
    expect(source!.measures.length).toBeGreaterThan(0);
    expect(source!.dimensions.length).toBeGreaterThan(0);
  });

  it('returns undefined for unknown data source', async () => {
    const { getDataSource } = await import('../src/lib/data-source-registry.js');
    const source = getDataSource('nonexistent', 'fake');

    expect(source).toBeUndefined();
  });

  it('lists sources by product', async () => {
    const { listDataSourcesByProduct } = await import('../src/lib/data-source-registry.js');
    const bondSources = listDataSourcesByProduct('bond');

    expect(bondSources.length).toBeGreaterThan(0);
    expect(bondSources.every((s) => s.product === 'bond')).toBe(true);
  });

  it('all sources have required fields', async () => {
    const { listDataSources } = await import('../src/lib/data-source-registry.js');
    const sources = listDataSources();

    for (const source of sources) {
      expect(source.product).toBeTruthy();
      expect(source.entity).toBeTruthy();
      expect(source.label).toBeTruthy();
      expect(source.baseTable).toBeTruthy();
      expect(source.measures.length).toBeGreaterThan(0);
    }
  });
});
