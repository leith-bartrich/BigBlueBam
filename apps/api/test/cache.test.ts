import { describe, it, expect, vi } from 'vitest';
import { cacheGetOrSet, cacheInvalidate, CACHE_KEYS } from '../src/lib/cache.js';

/**
 * Minimal in-test Redis double. Only implements the commands cache.ts
 * touches: get, set (with EX), del. Throwing variants are built inline
 * per-test via vi.spyOn / overrides.
 */
function makeFakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string, _mode: string, _ttl: number) => {
      store.set(k, v);
      return 'OK';
    }),
    del: vi.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
  };
}

describe('cache helper', () => {
  it('cache miss: calls fetcher and writes result with TTL', async () => {
    const redis = makeFakeRedis();
    const fetcher = vi.fn(async () => ({ name: 'Acme' }));

    const result = await cacheGetOrSet(redis as never, 'bbb:test:1', 60, fetcher);

    expect(result).toEqual({ name: 'Acme' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith('bbb:test:1', JSON.stringify({ name: 'Acme' }), 'EX', 60);
  });

  it('cache hit: returns parsed value without calling fetcher', async () => {
    const redis = makeFakeRedis();
    redis.store.set('bbb:test:2', JSON.stringify({ cached: true }));
    const fetcher = vi.fn(async () => ({ cached: false }));

    const result = await cacheGetOrSet(redis as never, 'bbb:test:2', 60, fetcher);

    expect(result).toEqual({ cached: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('falls through to fetcher when Redis throws on GET', async () => {
    const redis = {
      get: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
      set: vi.fn(async () => 'OK'),
      del: vi.fn(async () => 1),
    };
    const fetcher = vi.fn(async () => ({ fallback: true }));

    const result = await cacheGetOrSet(redis as never, 'bbb:test:3', 60, fetcher);

    expect(result).toEqual({ fallback: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    // set should not have been called because GET already threw the try block.
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('falls through to fetcher when stored value is corrupt JSON', async () => {
    const redis = makeFakeRedis();
    redis.store.set('bbb:test:4', '{not-json');
    const fetcher = vi.fn(async () => ({ fresh: 1 }));

    const result = await cacheGetOrSet(redis as never, 'bbb:test:4', 60, fetcher);

    expect(result).toEqual({ fresh: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    // Corrupt entry is overwritten with the fresh payload.
    expect(redis.store.get('bbb:test:4')).toBe(JSON.stringify({ fresh: 1 }));
  });

  it('cacheInvalidate deletes the key and swallows redis errors', async () => {
    const redis = makeFakeRedis();
    redis.store.set('bbb:test:5', '"x"');

    await cacheInvalidate(redis as never, 'bbb:test:5');
    expect(redis.store.has('bbb:test:5')).toBe(false);

    const throwingRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    // Must not throw.
    await expect(
      cacheInvalidate(throwingRedis as never, 'bbb:test:5'),
    ).resolves.toBeUndefined();
  });

  it('CACHE_KEYS builds the documented prefix format', () => {
    expect(CACHE_KEYS.orgSettings('abc')).toBe('bbb:org:abc:settings');
    expect(CACHE_KEYS.userProjects('u1')).toBe('bbb:user:u1:projects');
  });
});
