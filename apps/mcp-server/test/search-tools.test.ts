import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../src/middleware/api-client.js';
import { registerSearchTools } from '../src/tools/search-tools.js';

// ---------------------------------------------------------------------------
// Test scaffolding. Mirrors the pattern in visibility-tools.test.ts:
// - A lightweight McpServer stand-in collects registered handlers.
// - fetch is stubbed globally so we can script per-URL responses.
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const logger = pino({ level: 'silent' });

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

interface RegisteredTool {
  name: string;
  description: string;
  schema: unknown;
  handler: ToolHandler;
}

function createMockServer(): { server: McpServer; tools: Map<string, RegisteredTool> } {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    tool: (
      name: string,
      description: string,
      schema: unknown,
      handler: ToolHandler,
    ) => {
      tools.set(name, { name, description, schema, handler });
    },
  } as unknown as McpServer;
  return { server, tools };
}

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const UUID2 = '660e8400-e29b-41d4-a716-446655440001';
const UUID3 = '770e8400-e29b-41d4-a716-446655440002';
const UUID4 = '880e8400-e29b-41d4-a716-446655440003';

const URLS = {
  apiUrl: 'http://api.test',
  helpdeskApiUrl: 'http://helpdesk.test',
  bondApiUrl: 'http://bond.test',
  briefApiUrl: 'http://brief.test',
  beaconApiUrl: 'http://beacon.test',
  banterApiUrl: 'http://banter.test',
  boardApiUrl: 'http://board.test',
};

/**
 * Per-URL-substring response router. Each call to the router picks the
 * first handler whose substring appears in the target URL. Returning
 * undefined from a handler falls through to the next. This lets each
 * test declaratively wire up the arms it cares about without caring
 * about fan-out ordering.
 */
type Route = { match: string; respond: () => unknown | undefined | Promise<unknown> };

function installRouter(routes: Route[]): void {
  mockFetch.mockImplementation(async (url: string) => {
    for (const r of routes) {
      if (url.includes(r.match)) {
        const out = await r.respond();
        if (out === undefined) continue;
        const payload = out as { status?: number; ok?: boolean; body?: unknown };
        const status = payload.status ?? 200;
        const ok = payload.ok ?? (status >= 200 && status < 300);
        return {
          ok,
          status,
          json: async () => payload.body ?? {},
        };
      }
    }
    // Unmatched URL: return empty success so the arm contributes no hits
    // instead of bubbling up a global error.
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    };
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('search_everything MCP tool', () => {
  let tools: Map<string, RegisteredTool>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new ApiClient('http://api.test', 'test-token', logger);
    const mock = createMockServer();
    tools = mock.tools;
    registerSearchTools(mock.server, api, URLS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getTool(name: string): RegisteredTool {
    const t = tools.get(name);
    if (!t) throw new Error(`Tool "${name}" not registered`);
    return t;
  }

  it('registers search_everything', () => {
    expect(tools.has('search_everything')).toBe(true);
    expect(tools.get('search_everything')!.description).toMatch(/cross-app/i);
  });

  it('populates errors[] when one arm rejects but still succeeds overall', async () => {
    installRouter([
      // Bam projects list: required for the tasks arm.
      {
        match: '/projects?limit=50',
        respond: () => ({ body: { data: [{ id: UUID }] } }),
      },
      // Bam tasks-per-project: returns two tasks.
      {
        match: `/projects/${UUID}/tasks?`,
        respond: () => ({
          body: {
            data: [
              { id: UUID2, title: 'login bug', description: 'hot' },
              { id: UUID3, title: 'login ticket follow-up' },
            ],
          },
        }),
      },
      // Helpdesk deliberately errors so we can assert errors[].
      {
        match: '/tickets/search',
        respond: () => ({ ok: false, status: 500, body: { error: 'boom' } }),
      },
    ]);

    const result = await getTool('search_everything').handler({
      query: 'login',
      types: ['task', 'ticket'],
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    // Bam task hits still present.
    expect(parsed.data.length).toBeGreaterThanOrEqual(2);
    // Helpdesk arm surfaces as an error.
    expect(Array.isArray(parsed.errors)).toBe(true);
    expect(parsed.errors.find((e: { source_app: string }) => e.source_app === 'helpdesk')).toBeTruthy();
    // Counts tally the surviving hits.
    expect(parsed.counts_by_type.task).toBe(2);
    expect(parsed.query_took_ms).toBeGreaterThanOrEqual(0);
  });

  it('normalizes scores so a scored Beacon hit outranks an unscored mid-rank Brief hit', async () => {
    // Beacon returns one hit with a high relevance_score.
    // Brief returns 10 unscored documents; the one we care about is at
    // rank 2 (idx=1) so its local_score becomes 1 - 1/10 = 0.9. After
    // normalization (max=0.9 for Brief, max=0.9 for Beacon) both become
    // 1.0 locally, but after weights (beacon=1.2, brief=0.9) Beacon
    // wins cleanly.
    const briefDocs = Array.from({ length: 10 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      title: `doc ${i}`,
    }));
    installRouter([
      // '/documents/search' must come before '/search' — the router matches
      // on `url.includes(route.match)`, and a brief URL like
      // '/brief/api/documents/search' would also match a bare '/search'
      // entry, accidentally routing the brief call into the beacon mock.
      {
        match: '/documents/search',
        respond: () => ({ body: { data: briefDocs } }),
      },
      {
        match: '/search',
        respond: (): unknown => ({
          body: {
            results: [
              {
                beacon_id: UUID,
                title: 'the one beacon',
                summary: 'deploy guide',
                relevance_score: 0.9,
              },
            ],
          },
        }),
      },
    ]);

    const result = await getTool('search_everything').handler({
      query: 'deploy',
      types: ['beacon', 'document'],
    });
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.data[0].entity_type).toBe('beacon');
    // Beacon weighted score (1.0 * 1.2) should beat anything Brief can
    // produce at weight 0.9.
    expect(parsed.data[0].score).toBeGreaterThan(parsed.data[1].score);
  });

  it('prunes fan-out when types[] narrows the scope', async () => {
    installRouter([
      {
        match: '/projects?limit=50',
        respond: () => ({ body: { data: [{ id: UUID }] } }),
      },
      {
        match: `/projects/${UUID}/tasks?`,
        respond: () => ({
          body: { data: [{ id: UUID2, title: 't' }] },
        }),
      },
      {
        match: '/tickets/search',
        respond: () => ({ body: { data: [{ id: UUID3, subject: 's' }] } }),
      },
    ]);

    await getTool('search_everything').handler({
      query: 'deploy',
      types: ['task', 'ticket'],
    });

    // Only Bam (projects list + per-project tasks) and Helpdesk should
    // have been touched. Beacon/Brief/Bond/Banter/Board must not be hit.
    const calledUrls = mockFetch.mock.calls.map((c) => c[0] as string);
    expect(calledUrls.some((u) => u.includes('beacon.test'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('brief.test'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('bond.test'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('banter.test'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('board.test'))).toBe(false);
    // And the arms we do want were actually called.
    expect(calledUrls.some((u) => u.includes('api.test/projects'))).toBe(true);
    expect(calledUrls.some((u) => u.includes('helpdesk.test/tickets/search'))).toBe(true);
  });

  it('runs can_access per hit when as_user_id is present and counts denials in filtered_count', async () => {
    // Set up: two Bam tasks come back. The second one is denied by
    // can_access. filtered_count should be 1.
    installRouter([
      {
        match: '/projects?limit=50',
        respond: () => ({ body: { data: [{ id: UUID }] } }),
      },
      {
        match: `/projects/${UUID}/tasks?`,
        respond: () => ({
          body: {
            data: [
              { id: UUID2, title: 'visible' },
              { id: UUID3, title: 'denied' },
            ],
          },
        }),
      },
      {
        match: '/v1/visibility/can_access',
        respond: () => undefined, // handled by second router below
      },
    ]);

    // Because both can_access checks hit the same URL, override fetch
    // after the initial router with a sequence-aware dispatcher.
    let canAccessCalls = 0;
    const allowedIds = new Set<string>([UUID2]);
    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.includes('/projects?limit=50')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: UUID }] }),
        };
      }
      if (url.includes(`/projects/${UUID}/tasks?`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: UUID2, title: 'visible' },
              { id: UUID3, title: 'denied' },
            ],
          }),
        };
      }
      if (url.includes('/v1/visibility/can_access')) {
        canAccessCalls += 1;
        const body = JSON.parse(String(init.body ?? '{}')) as {
          entity_id?: string;
        };
        const allowed = allowedIds.has(String(body.entity_id));
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { allowed, reason: allowed ? 'ok' : 'not_member' } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      };
    });

    const result = await getTool('search_everything').handler({
      query: 'task',
      types: ['task'],
      as_user_id: UUID4,
    });

    const parsed = JSON.parse(result.content[0]!.text);
    expect(canAccessCalls).toBe(2);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].entity_id).toBe(UUID2);
    expect(parsed.filtered_count).toBe(1);
  });

  it('3s AbortController timeout turns a stuck arm into an errors[] entry', async () => {
    vi.useFakeTimers();

    // helpdesk never resolves. Bam returns empty fast.
    mockFetch.mockImplementation((url: string, init: RequestInit) => {
      if (url.includes('helpdesk.test')) {
        return new Promise((_resolve, reject) => {
          // Listen for abort and reject with an AbortError-shaped error.
          const signal = init.signal as AbortSignal | undefined;
          if (!signal) return;
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            (err as Error & { name: string }).name = 'AbortError';
            reject(err);
          });
        });
      }
      if (url.includes('api.test/projects')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });
    });

    const handler = getTool('search_everything').handler({
      query: 'stuck',
      types: ['task', 'ticket'],
    });

    // Fast-forward past the 3s AbortController timeout.
    await vi.advanceTimersByTimeAsync(3_500);

    const result = await handler;
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.errors).toBeDefined();
    const helpdeskErr = parsed.errors.find(
      (e: { source_app: string }) => e.source_app === 'helpdesk',
    );
    expect(helpdeskErr).toBeTruthy();
    expect(helpdeskErr.message).toMatch(/timed out|abort/i);
  });
});
