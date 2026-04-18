// §20 Wave 5 webhooks
import { describe, it, expect } from 'vitest';

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
