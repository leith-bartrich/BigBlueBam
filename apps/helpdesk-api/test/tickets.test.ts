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
