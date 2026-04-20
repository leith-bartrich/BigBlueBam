// §1 Wave 5 banter subs - pattern-matcher unit tests.
//
// Covers evaluateBanterPattern for all four kinds, plus the
// validatePatternSpec gate that runs at subscription write time.

import { describe, it, expect, vi } from 'vitest';

// Mock env + db so loading the service (which transitively imports these)
// does not run env validation against CI's test environment.
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

import {
  evaluateBanterPattern,
  isInterrogative,
  isRequest,
  canonicalizeBanterPatternSpec,
  type BanterPatternSpec,
} from '@bigbluebam/shared';
import { validatePatternSpec } from '../src/services/agent-subscriptions.service.js';

describe('isInterrogative', () => {
  it('matches trailing question marks', () => {
    expect(isInterrogative('Is this a question?')).toBe(true);
    expect(isInterrogative('really?  ')).toBe(true);
  });

  it('matches wh-word openings', () => {
    expect(isInterrogative('who broke the build')).toBe(true);
    expect(isInterrogative('How do I deploy')).toBe(true);
    expect(isInterrogative('Which PR is this in')).toBe(true);
  });

  it('matches yes/no interrogative auxiliaries at start', () => {
    expect(isInterrogative('can you help')).toBe(true);
    expect(isInterrogative('Did anyone merge that')).toBe(true);
  });

  it('does not match plain statements', () => {
    expect(isInterrogative('I merged the PR')).toBe(false);
    expect(isInterrogative('Ship it.')).toBe(false);
  });

  it('handles empty and whitespace input', () => {
    expect(isInterrogative('')).toBe(false);
    expect(isInterrogative('    ')).toBe(false);
  });
});

describe('isRequest', () => {
  it('matches common request verbs', () => {
    expect(isRequest('please close the ticket')).toBe(true);
    expect(isRequest('can you look at this')).toBe(true);
    expect(isRequest('Would you mind')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(isRequest('PLEASE help')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(isRequest('nothing interesting here')).toBe(false);
  });
});

describe('evaluateBanterPattern - interrogative', () => {
  const spec: BanterPatternSpec = { kind: 'interrogative' };

  it('matches a question', () => {
    const out = evaluateBanterPattern(spec, 'What is the status?');
    expect(out.matched).toBe(true);
    expect(out.matched_text).toBe('What is the status?');
  });

  it('does not match a plain statement', () => {
    expect(evaluateBanterPattern(spec, 'All clear.').matched).toBe(false);
  });

  it('returns non-match for empty content', () => {
    expect(evaluateBanterPattern(spec, '').matched).toBe(false);
  });
});

describe('evaluateBanterPattern - keyword', () => {
  it("matches 'any' mode when at least one term is present", () => {
    const spec: BanterPatternSpec = { kind: 'keyword', terms: ['deploy', 'ship'] };
    expect(evaluateBanterPattern(spec, 'we should ship it').matched).toBe(true);
    expect(evaluateBanterPattern(spec, 'nothing to do').matched).toBe(false);
  });

  it("matches 'all' mode only when every term is present", () => {
    const spec: BanterPatternSpec = {
      kind: 'keyword',
      terms: ['deploy', 'prod'],
      mode: 'all',
    };
    expect(evaluateBanterPattern(spec, 'deploy to prod now').matched).toBe(true);
    expect(evaluateBanterPattern(spec, 'deploy this to staging').matched).toBe(false);
  });

  it('is case insensitive by default', () => {
    const spec: BanterPatternSpec = { kind: 'keyword', terms: ['BUILD'] };
    expect(evaluateBanterPattern(spec, 'the build broke').matched).toBe(true);
  });

  it('respects case_sensitive: true', () => {
    const spec: BanterPatternSpec = {
      kind: 'keyword',
      terms: ['BUILD'],
      case_sensitive: true,
    };
    expect(evaluateBanterPattern(spec, 'the build broke').matched).toBe(false);
    expect(evaluateBanterPattern(spec, 'the BUILD broke').matched).toBe(true);
  });

  it('returns non-match on empty terms list', () => {
    const spec = { kind: 'keyword', terms: [] as string[] } as BanterPatternSpec;
    expect(evaluateBanterPattern(spec, 'anything at all').matched).toBe(false);
  });
});

describe('evaluateBanterPattern - regex', () => {
  it('matches a simple anchored pattern', () => {
    const spec: BanterPatternSpec = { kind: 'regex', pattern: '^deploy\\s+(\\w+)' };
    const out = evaluateBanterPattern(spec, 'deploy production');
    expect(out.matched).toBe(true);
    // matched_text is the .[0] group for regex.
    expect(out.matched_text).toBe('deploy production');
  });

  it('honors flags', () => {
    const spec: BanterPatternSpec = { kind: 'regex', pattern: 'error', flags: 'i' };
    expect(evaluateBanterPattern(spec, 'ERROR 500 thrown').matched).toBe(true);
  });

  it('returns non-match on malformed regex without throwing', () => {
    const spec: BanterPatternSpec = { kind: 'regex', pattern: '[' };
    expect(() => evaluateBanterPattern(spec, 'anything')).not.toThrow();
    expect(evaluateBanterPattern(spec, 'anything').matched).toBe(false);
  });
});

describe('evaluateBanterPattern - mention', () => {
  const spec: BanterPatternSpec = {
    kind: 'mention',
    user_id: '00000000-0000-0000-0000-000000000001',
    display_name: 'Ada',
  };

  it('matches @Ada', () => {
    expect(evaluateBanterPattern(spec, 'hey @Ada take a look').matched).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(evaluateBanterPattern(spec, 'cc @ada on this').matched).toBe(true);
  });

  it('does not match a bare name without @', () => {
    expect(evaluateBanterPattern(spec, 'ada please review').matched).toBe(false);
  });
});

describe('canonicalizeBanterPatternSpec', () => {
  it('produces the same string for equivalent specs regardless of key order', () => {
    const a: BanterPatternSpec = {
      kind: 'keyword',
      terms: ['foo'],
      mode: 'any',
    };
    const b: BanterPatternSpec = {
      mode: 'any',
      terms: ['foo'],
      kind: 'keyword',
    } as BanterPatternSpec;
    expect(canonicalizeBanterPatternSpec(a)).toBe(canonicalizeBanterPatternSpec(b));
  });
});

describe('validatePatternSpec', () => {
  it('accepts interrogative', () => {
    const v = validatePatternSpec({ kind: 'interrogative' });
    expect(v.ok).toBe(true);
  });

  it('rejects keyword with empty terms', () => {
    const v = validatePatternSpec({ kind: 'keyword', terms: [] });
    expect(v.ok).toBe(false);
  });

  it('rejects keyword with > 50 terms', () => {
    const v = validatePatternSpec({
      kind: 'keyword',
      terms: Array.from({ length: 51 }, (_, i) => `t${i}`),
    });
    expect(v.ok).toBe(false);
  });

  it('rejects bad mode', () => {
    const v = validatePatternSpec({ kind: 'keyword', terms: ['x'], mode: 'bogus' });
    expect(v.ok).toBe(false);
  });

  it('rejects regex with malformed pattern', () => {
    const v = validatePatternSpec({ kind: 'regex', pattern: '[' });
    expect(v.ok).toBe(false);
  });

  it('accepts a valid regex', () => {
    const v = validatePatternSpec({ kind: 'regex', pattern: 'foo\\d+', flags: 'i' });
    expect(v.ok).toBe(true);
  });

  it('rejects mention missing user_id', () => {
    const v = validatePatternSpec({ kind: 'mention', display_name: 'Ada' });
    expect(v.ok).toBe(false);
  });

  it('rejects unknown kind', () => {
    const v = validatePatternSpec({ kind: 'nonsense' });
    expect(v.ok).toBe(false);
  });
});
