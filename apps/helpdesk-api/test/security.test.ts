import { describe, it, vi } from 'vitest';

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  connection: { end: vi.fn() },
}));

vi.mock('../src/env.js', () => ({
  env: {
    PORT: 4001,
    DATABASE_URL: 'postgres://test:test@localhost/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    HELPDESK_URL: 'http://localhost:8080',
    CORS_ORIGIN: 'http://localhost:8080',
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    SESSION_TTL_SECONDS: 604800,
    AGENT_API_KEY: 'test-agent-key',
  },
}));

// ============================================================================
// Security regression test skeleton. Each `it.todo` is a placeholder for a
// full integration test that should be fleshed out once an in-memory / test
// postgres harness is wired up for helpdesk-api. These correspond to the
// critical fixes called out in the HB-* security audit.
// ============================================================================

describe('HB-4: reopen ownership enforcement', () => {
  it.todo(
    'customer A cannot reopen customer B\'s ticket — UPDATE WHERE must include helpdesk_user_id',
  );
  it.todo(
    'returns 404 (not 403) when a ticket exists but is owned by a different helpdesk_user',
  );
});

describe('HB-6: agent org scoping', () => {
  it.todo(
    'agent with valid BBB session sees only tickets whose project belongs to session.org_id',
  );
  it.todo(
    'agent without session sees all tickets (known limitation of shared X-Agent-Key trust model)',
  );
});

describe('HB-12: agent endpoint auth', () => {
  it.todo(
    'BBB session cookie alone (no X-Agent-Key / Bearer) cannot authenticate to agent endpoints — must return 401',
  );
  it.todo(
    'valid X-Agent-Key authenticates even without a BBB session cookie',
  );
  it.todo(
    'timing-safe comparison is used for the agent key check',
  );
});

describe('HB-14: message author_id forgery prevention', () => {
  it.todo(
    'when a BBB session accompanies the request, author_id is taken from the session and cannot be overridden by the request body',
  );
  it.todo(
    'X-Agent-Key-only caller must supply author_id AND it must resolve to a real user row',
  );
  it.todo(
    'X-Agent-Key-only caller cannot forge author_id belonging to a user in a different org than the ticket\'s project',
  );
});
