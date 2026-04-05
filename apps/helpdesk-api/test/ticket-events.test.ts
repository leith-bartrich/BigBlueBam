// HB-47: integration-style tests for the durable event replay endpoint.
//
// These tests exercise the shape of the GET /helpdesk/tickets/:id/events
// and GET /helpdesk/events handlers: ownership gating, the since/limit
// cursor semantics, has_more / latest_id computation, and the
// 404-anti-enumeration guarantee inherited from the other ticket routes.
//
// They do NOT boot the real helpdesk-api server — the route logic is
// exercised through a minimal Fastify instance wired to the same db
// mock pattern used by security.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const dbMock: any = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
};

vi.mock('../src/db/index.js', () => ({
  db: dbMock,
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
    LOG_LEVEL: 'silent',
    SESSION_TTL_SECONDS: 604800,
  },
}));

vi.mock('../src/services/realtime.js', () => ({
  broadcastTicketMessage: vi.fn(async () => {}),
  broadcastTicketStatusChanged: vi.fn(async () => {}),
  broadcastTicketUpdated: vi.fn(async () => {}),
}));

vi.mock('../src/lib/broadcast.js', () => ({
  broadcastTaskCreated: vi.fn(async () => {}),
  broadcastTicketStatusChanged: vi.fn(async () => {}),
  broadcastTicketMessage: vi.fn(async () => {}),
}));

vi.mock('../src/lib/task-sync.js', () => ({
  mirrorTicketMessageToTask: vi.fn(async () => {}),
  mirrorTicketClosedToTask: vi.fn(async () => {}),
}));

vi.mock('../src/lib/ticket-activity.js', () => ({
  logTicketActivity: vi.fn(async () => {}),
}));

// Bypass auth: the preHandler just stamps request.helpdeskUser and returns.
vi.mock('../src/plugins/auth.js', () => ({
  requireHelpdeskAuth: async (request: any) => {
    request.helpdeskUser = {
      id: 'user-1',
      email: 'c@example.com',
      display_name: 'Customer One',
      is_active: true,
    };
  },
}));

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { default: ticketRoutes } = await import('../src/routes/ticket.routes.js');
  await app.register(ticketRoutes);
  return app;
}

/**
 * The route uses drizzle's query builder in a select().from().where()....limit()
 * chain. Each call in the chain needs to return a thenable terminator, so we
 * build a chainable stub whose terminal `limit` resolves to the given rows.
 */
function selectChain(rows: unknown[]) {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  // Some routes call .select().from().where() without a .limit; make the
  // chain itself thenable too.
  chain.then = (resolve: any) => resolve(rows);
  return chain;
}

describe('HB-47: GET /helpdesk/tickets/:id/events', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    dbMock.select.mockReset();
    app = await buildApp();
  });

  it('returns 404 when the ticket does not belong to the caller', async () => {
    // First select = ownership check, returns no rows.
    dbMock.select.mockReturnValueOnce(selectChain([]));
    const res = await app.inject({
      method: 'GET',
      url: '/helpdesk/tickets/t-1/events?since=0&limit=10',
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns page data with has_more=false and latest_id=last event id', async () => {
    // Ownership check passes.
    dbMock.select.mockReturnValueOnce(selectChain([{ id: 't-1' }]));
    // Events query returns 2 rows, under the limit → has_more=false.
    dbMock.select.mockReturnValueOnce(
      selectChain([
        { id: 10, ticket_id: 't-1', event_type: 'ticket.message.created', payload: { a: 1 }, created_at: '2026-01-01T00:00:00Z' },
        { id: 12, ticket_id: 't-1', event_type: 'ticket.status.changed', payload: { b: 2 }, created_at: '2026-01-01T00:00:01Z' },
      ]),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/helpdesk/tickets/t-1/events?since=5&limit=10',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.has_more).toBe(false);
    expect(body.latest_id).toBe(12);
  });

  it('trims to limit and sets has_more=true when the fetched rows exceed limit', async () => {
    dbMock.select.mockReturnValueOnce(selectChain([{ id: 't-1' }]));
    // Ask limit=2; route fetches limit+1=3. Return 3 rows → has_more=true.
    dbMock.select.mockReturnValueOnce(
      selectChain([
        { id: 1, ticket_id: 't-1', event_type: 'e', payload: {}, created_at: '2026-01-01T00:00:00Z' },
        { id: 2, ticket_id: 't-1', event_type: 'e', payload: {}, created_at: '2026-01-01T00:00:01Z' },
        { id: 3, ticket_id: 't-1', event_type: 'e', payload: {}, created_at: '2026-01-01T00:00:02Z' },
      ]),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/helpdesk/tickets/t-1/events?since=0&limit=2',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.has_more).toBe(true);
    expect(body.latest_id).toBe(2); // last id of the trimmed page
  });
});

describe('HB-47: GET /helpdesk/events (all owned tickets)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    dbMock.select.mockReset();
    app = await buildApp();
  });

  it('short-circuits with an empty page when the caller owns no tickets', async () => {
    dbMock.select.mockReturnValueOnce(selectChain([]));
    const res = await app.inject({ method: 'GET', url: '/helpdesk/events?since=0&limit=10' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toEqual([]);
    expect(body.has_more).toBe(false);
    expect(body.latest_id).toBeNull();
  });

  it('returns events scoped to the caller\'s owned tickets', async () => {
    // First select = owned tickets ids.
    dbMock.select.mockReturnValueOnce(selectChain([{ id: 't-1' }, { id: 't-2' }]));
    // Second select = events across those tickets.
    dbMock.select.mockReturnValueOnce(
      selectChain([
        { id: 20, ticket_id: 't-1', event_type: 'ticket.message.created', payload: {}, created_at: '2026-01-01T00:00:00Z' },
        { id: 21, ticket_id: 't-2', event_type: 'ticket.updated', payload: {}, created_at: '2026-01-01T00:00:01Z' },
      ]),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/helpdesk/events?since=10&limit=50',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.latest_id).toBe(21);
    expect(body.has_more).toBe(false);
  });
});
