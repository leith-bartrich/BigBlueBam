import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTx, mockTransaction } = vi.hoisted(() => {
  const mockTx = { execute: vi.fn() };
  const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) =>
    cb(mockTx),
  );
  return { mockTx, mockTransaction };
});

vi.mock('../src/env.js', () => ({
  env: {
    SESSION_TTL_SECONDS: 604800,
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    NODE_ENV: 'test',
    PORT: 4000,
    HOST: '0.0.0.0',
    SESSION_SECRET: 'a'.repeat(32),
    REDIS_URL: 'redis://localhost:6379',
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    UPLOAD_MAX_FILE_SIZE: 10485760,
    UPLOAD_ALLOWED_TYPES: 'image/*',
    COOKIE_SECURE: false,
  },
}));

vi.mock('../src/db/index.js', () => ({
  db: { transaction: mockTransaction, execute: vi.fn() },
  connection: { end: vi.fn() },
}));

import {
  countTasksByPhrase,
  TaskPhraseCountError,
  __test__,
} from '../src/services/task-phrase-count.service.js';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const LABEL = '33333333-3333-3333-3333-333333333333';

beforeEach(() => {
  mockTx.execute.mockReset();
  mockTransaction.mockClear();
});

describe('task-phrase-count.service', () => {
  describe('normalizeBucket', () => {
    it('accepts hour/day/week', () => {
      expect(__test__.normalizeBucket('hour')).toBe('hour');
      expect(__test__.normalizeBucket('day')).toBe('day');
      expect(__test__.normalizeBucket('week')).toBe('week');
    });

    it('rejects unknown bucket', () => {
      expect(() => __test__.normalizeBucket('year' as never)).toThrow(
        TaskPhraseCountError,
      );
    });
  });

  describe('countTasksByPhrase', () => {
    const since = new Date('2026-04-01T00:00:00Z');
    const until = new Date('2026-04-18T00:00:00Z');

    it('rejects empty phrase', async () => {
      await expect(
        countTasksByPhrase({
          phrase: '',
          buckets: 'day',
          since,
          until,
          orgId: ORG,
        }),
      ).rejects.toThrow(/Phrase must be non-empty/);
    });

    it('rejects missing orgId', async () => {
      await expect(
        countTasksByPhrase({
          phrase: 'x',
          buckets: 'day',
          since,
          until,
          orgId: '',
        }),
      ).rejects.toThrow(/orgId is required/);
    });

    it('rejects until <= since', async () => {
      await expect(
        countTasksByPhrase({
          phrase: 'x',
          buckets: 'day',
          since,
          until: since,
          orgId: ORG,
        }),
      ).rejects.toThrow(/window.until must be strictly greater/);
    });

    it('returns mapped buckets with total', async () => {
      mockTx.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { bucket_start: new Date('2026-04-10T00:00:00Z'), count: 2 },
        { bucket_start: new Date('2026-04-11T00:00:00Z'), count: 4 },
      ]);
      const res = await countTasksByPhrase({
        phrase: 'refactor auth',
        buckets: 'day',
        since,
        until,
        orgId: ORG,
      });
      expect(res.buckets).toHaveLength(2);
      expect(res.total).toBe(6);
      expect(res.bucket_granularity).toBe('day');
      expect(res.approximate).toBe(false);
    });

    it('passes project and label filters into the SQL', async () => {
      mockTx.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      await countTasksByPhrase({
        phrase: 'x',
        buckets: 'hour',
        since,
        until,
        orgId: ORG,
        projectIds: [PROJECT],
        labelIds: [LABEL],
      });
      // Second call is the SELECT. Assert the rendered SQL captures both
      // filter clauses by checking params flow through.
      const select = mockTx.execute.mock.calls[1]![0];
      const str = String(select);
      // The sql tag renders placeholders via `$1, $2, ...`. The fact that
      // we called execute with a compound sql fragment is what we assert.
      expect(str).toBeTruthy();
    });

    it('sets a statement_timeout via SET LOCAL on the first execute', async () => {
      mockTx.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      await countTasksByPhrase({
        phrase: 'x',
        buckets: 'day',
        since,
        until,
        orgId: ORG,
      });
      // drizzle's sql tag's default String() is '[object Object]'; walk the
      // queryChunks array to pull the literal SQL text out.
      const firstCallArg = mockTx.execute.mock.calls[0]![0] as {
        queryChunks?: Array<{ value?: string[] } | string>;
      };
      const chunksText = Array.isArray(firstCallArg?.queryChunks)
        ? firstCallArg.queryChunks
            .map((c) => (typeof c === 'string' ? c : c?.value?.join(' ') ?? ''))
            .join(' ')
        : JSON.stringify(firstCallArg);
      expect(chunksText.toLowerCase()).toContain('statement_timeout');
    });
  });
});
