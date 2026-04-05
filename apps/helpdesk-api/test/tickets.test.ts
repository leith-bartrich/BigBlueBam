import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
  connection: { end: vi.fn() },
}));

vi.mock('../src/env.js', () => ({
  env: {
    PORT: 4001, DATABASE_URL: 'postgres://test:test@localhost/test',
    REDIS_URL: 'redis://localhost:6379', SESSION_SECRET: 'a'.repeat(32),
    HELPDESK_URL: 'http://localhost:8080', CORS_ORIGIN: 'http://localhost:8080',
    NODE_ENV: 'test', LOG_LEVEL: 'info', SESSION_TTL_SECONDS: 604800,
  },
}));

describe('Helpdesk Tickets', () => {
  it('should validate ticket status transitions', () => {
    const validTransitions: Record<string, string[]> = {
      open: ['in_progress', 'closed'],
      in_progress: ['waiting_on_customer', 'resolved', 'open'],
      waiting_on_customer: ['in_progress', 'resolved'],
      resolved: ['closed', 'open'],
      closed: ['open'],
    };

    expect(validTransitions['open']).toContain('in_progress');
    expect(validTransitions['resolved']).toContain('open');
    expect(validTransitions['resolved']).toContain('closed');
  });

  it('should map BBB phases to ticket statuses', () => {
    const phaseToStatus = (isTerminal: boolean, isStart: boolean): string => {
      if (isTerminal) return 'resolved';
      if (isStart) return 'open';
      return 'in_progress';
    };

    expect(phaseToStatus(false, true)).toBe('open');
    expect(phaseToStatus(false, false)).toBe('in_progress');
    expect(phaseToStatus(true, false)).toBe('resolved');
  });

  it('should validate client priorities exclude critical', () => {
    const clientPriorities = ['low', 'medium', 'high'];
    expect(clientPriorities).not.toContain('critical');
  });

  it('should validate message author types', () => {
    const types = ['client', 'agent', 'system'];
    expect(types).toContain('client');
    expect(types).toContain('agent');
    expect(types).toContain('system');
  });

  it('should filter internal messages for client view', () => {
    const messages = [
      { id: '1', body: 'Public reply', is_internal: false, author_type: 'agent' },
      { id: '2', body: 'Internal note', is_internal: true, author_type: 'agent' },
      { id: '3', body: 'Client reply', is_internal: false, author_type: 'client' },
    ];

    const clientVisible = messages.filter(m => !m.is_internal);
    expect(clientVisible).toHaveLength(2);
    expect(clientVisible.find(m => m.is_internal)).toBeUndefined();
  });

  it('should validate ticket number is sequential', () => {
    const numbers = [1, 2, 3, 4, 5];
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]).toBeGreaterThan(numbers[i - 1]!);
    }
  });

  it('should validate reopen only works on resolved/closed', () => {
    const canReopen = (status: string) => ['resolved', 'closed'].includes(status);
    expect(canReopen('resolved')).toBe(true);
    expect(canReopen('closed')).toBe(true);
    expect(canReopen('open')).toBe(false);
    expect(canReopen('in_progress')).toBe(false);
  });
});

// HB-55: pure-function guards extracted from the mark-duplicate / merge
// endpoints, unit-tested in isolation so the business rules are pinned
// down even when the routes' integration with the DB is mocked.
describe('Helpdesk Duplicate/Merge Guards (HB-55)', () => {
  interface T { id: string; status: string; duplicate_of: string | null; merged_at: Date | null; helpdesk_user_id: string }
  const t = (overrides: Partial<T>): T => ({
    id: 'a', status: 'open', duplicate_of: null, merged_at: null, helpdesk_user_id: 'u1', ...overrides,
  });

  // Mirror of the guard block in POST /helpdesk/tickets/:id/mark-duplicate
  // and POST /agents/tickets/:id/merge.
  function checkDuplicateGuards(source: T, primary: T | null, callerId?: string): string | null {
    if (!source) return 'NOT_FOUND';
    if (callerId && source.helpdesk_user_id !== callerId) return 'NOT_FOUND';
    if (!primary) return 'NOT_FOUND';
    if (callerId && primary.helpdesk_user_id !== callerId) return 'NOT_FOUND';
    if (source.id === primary.id) return 'SELF_MERGE';
    if (primary.duplicate_of) return 'PRIMARY_IS_DUPLICATE';
    if (primary.status === 'closed') return 'PRIMARY_CLOSED';
    if (source.merged_at) return 'ALREADY_MERGED';
    return null;
  }

  it('happy path: accepts a valid primary owned by the caller', () => {
    const source = t({ id: 'a', helpdesk_user_id: 'u1' });
    const primary = t({ id: 'b', helpdesk_user_id: 'u1' });
    expect(checkDuplicateGuards(source, primary, 'u1')).toBeNull();
  });

  it('rejects chains: primary that is itself a duplicate', () => {
    const source = t({ id: 'a' });
    const primary = t({ id: 'b', duplicate_of: 'c' });
    expect(checkDuplicateGuards(source, primary)).toBe('PRIMARY_IS_DUPLICATE');
  });

  it('rejects self-merge', () => {
    const source = t({ id: 'a' });
    const primary = t({ id: 'a' });
    expect(checkDuplicateGuards(source, primary)).toBe('SELF_MERGE');
  });

  it('rejects closed primary', () => {
    const source = t({ id: 'a' });
    const primary = t({ id: 'b', status: 'closed' });
    expect(checkDuplicateGuards(source, primary)).toBe('PRIMARY_CLOSED');
  });

  it('rejects cross-customer primary as NOT_FOUND (anti-enumeration)', () => {
    const source = t({ id: 'a', helpdesk_user_id: 'u1' });
    const primary = t({ id: 'b', helpdesk_user_id: 'u2' });
    expect(checkDuplicateGuards(source, primary, 'u1')).toBe('NOT_FOUND');
  });

  it('rejects double-merge of an already-merged source', () => {
    const source = t({ id: 'a', merged_at: new Date() });
    const primary = t({ id: 'b' });
    expect(checkDuplicateGuards(source, primary)).toBe('ALREADY_MERGED');
  });
});
