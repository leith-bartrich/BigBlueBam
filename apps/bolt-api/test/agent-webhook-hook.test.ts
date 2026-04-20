// §20 Wave 5 webhooks
import { describe, it, expect, vi } from 'vitest';

// Loading webhook-dispatch-hook.js pulls in the db graph which imports
// env.js; env validation exits the process when SESSION_SECRET is not
// exported in the CI env. Mock env (and db) so the pure-helper test
// can run without the full env surface.
vi.mock('../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    SESSION_SECRET: 'x'.repeat(32),
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  },
}));
vi.mock('../src/db/index.js', () => ({
  db: {},
}));

// We only need to exercise the pure helper; the DB-dependent path is
// covered by end-to-end integration tests once CI has a live stack.
import { __test__ } from '../src/services/webhook-dispatch-hook.js';

describe('webhook-dispatch-hook: eventMatchesFilter', () => {
  it('empty filter matches nothing', () => {
    expect(__test__.eventMatchesFilter([], 'bond', 'deal.rotting')).toBe(false);
  });

  it('* is a global wildcard', () => {
    expect(__test__.eventMatchesFilter(['*'], 'bond', 'deal.rotting')).toBe(true);
    expect(__test__.eventMatchesFilter(['*'], 'bam', 'task.moved')).toBe(true);
  });

  it('source:* only matches that source', () => {
    expect(__test__.eventMatchesFilter(['bond:*'], 'bond', 'anything')).toBe(true);
    expect(__test__.eventMatchesFilter(['bond:*'], 'bam', 'anything')).toBe(false);
  });

  it('exact source:event_type match', () => {
    expect(__test__.eventMatchesFilter(['bond:deal.rotting'], 'bond', 'deal.rotting')).toBe(
      true,
    );
    expect(__test__.eventMatchesFilter(['bond:deal.rotting'], 'bond', 'deal.created')).toBe(
      false,
    );
  });

  it('multiple entries OR', () => {
    expect(
      __test__.eventMatchesFilter(['bam:*', 'bond:deal.rotting'], 'bond', 'deal.rotting'),
    ).toBe(true);
  });
});
