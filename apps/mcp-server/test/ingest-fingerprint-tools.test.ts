import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../src/middleware/api-client.js';
import { registerIngestFingerprintTools } from '../src/tools/ingest-fingerprint-tools.js';
import {
  createFingerprintStore,
  WindowTooLargeError,
  type FingerprintStore,
  FINGERPRINT_WINDOW_MAX_SECONDS,
} from '../src/lib/fingerprint-store.js';

/**
 * §19 Wave 5 misc — ingest_fingerprint_check tool tests.
 *
 * Covers:
 *   - first call in window returns first_seen: true
 *   - second call within window returns first_seen: false with seen_at + ttl
 *   - window_seconds over 3600 → WindowTooLargeError → isError with 400-coded body
 *   - Redis unavailable → graceful fallback with note: 'redis_unavailable'
 */

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

function mockApiOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => data });
}

const ORG = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

function mockAuthMe(orgId: string | null = ORG) {
  if (orgId === null) {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });
  } else {
    mockApiOk({ data: { id: USER, org_id: orgId, active_org_id: orgId } });
  }
}

// ---------------------------------------------------------------------------
// Tool handler: uses an in-memory stub store so the assertions don't depend
// on ioredis. Each test builds its own stub with the behavior it wants.
// ---------------------------------------------------------------------------

interface StubBehavior {
  checkAndSet?: FingerprintStore['checkAndSet'];
}

function makeStubStore(behavior: StubBehavior = {}): FingerprintStore {
  return {
    checkAndSet:
      behavior.checkAndSet ??
      (async (_org, _src, _fp, window) => ({ first_seen: true, window_seconds: window })),
    close: async () => {},
  };
}

describe('ingest_fingerprint_check MCP tool (§19 Wave 5)', () => {
  let tools: Map<string, RegisteredTool>;
  let api: ApiClient;
  let store: FingerprintStore;

  function register(stub: FingerprintStore) {
    vi.clearAllMocks();
    api = new ApiClient('http://localhost:4000', 'test-token', logger);
    const mock = createMockServer();
    tools = mock.tools;
    store = stub;
    registerIngestFingerprintTools(mock.server, api, store);
  }

  beforeEach(() => {
    register(makeStubStore());
  });

  function getTool(name: string): RegisteredTool {
    const t = tools.get(name);
    if (!t) throw new Error(`Tool "${name}" not registered`);
    return t;
  }

  it('registers ingest_fingerprint_check', () => {
    expect(tools.has('ingest_fingerprint_check')).toBe(true);
  });

  it('first call returns first_seen: true', async () => {
    mockAuthMe();
    const res = await getTool('ingest_fingerprint_check').handler({
      source: 'helpdesk_email',
      fingerprint: 'sha256:abc123def456',
      window_seconds: 300,
    });
    expect(res.isError).toBeUndefined();
    const body = JSON.parse(res.content[0]!.text);
    expect(body.first_seen).toBe(true);
    expect(body.window_seconds).toBe(300);
  });

  it('second call within window returns first_seen: false with seen_at + ttl', async () => {
    // A single shared stub that returns first_seen: true on the first call
    // and first_seen: false on subsequent calls — mimics the SET NX EX
    // semantics without a real Redis.
    let seen = false;
    register(
      makeStubStore({
        checkAndSet: async (_org, _src, _fp, window) => {
          if (!seen) {
            seen = true;
            return { first_seen: true, window_seconds: window };
          }
          return {
            first_seen: false,
            seen_at: '2026-04-18T10:00:00.000Z',
            window_seconds: window,
            ttl_remaining: 240,
          };
        },
      }),
    );

    mockAuthMe();
    const first = await getTool('ingest_fingerprint_check').handler({
      source: 'helpdesk_email',
      fingerprint: 'sha256:repeat',
      window_seconds: 300,
    });
    expect(JSON.parse(first.content[0]!.text).first_seen).toBe(true);

    mockAuthMe();
    const second = await getTool('ingest_fingerprint_check').handler({
      source: 'helpdesk_email',
      fingerprint: 'sha256:repeat',
      window_seconds: 300,
    });
    const body = JSON.parse(second.content[0]!.text);
    expect(body.first_seen).toBe(false);
    expect(body.seen_at).toBe('2026-04-18T10:00:00.000Z');
    expect(body.ttl_remaining).toBe(240);
  });

  it('window_seconds > 3600 is rejected via WindowTooLargeError → isError', async () => {
    register(
      makeStubStore({
        checkAndSet: async () => {
          throw new WindowTooLargeError(7200, FINGERPRINT_WINDOW_MAX_SECONDS);
        },
      }),
    );
    mockAuthMe();
    const res = await getTool('ingest_fingerprint_check').handler({
      source: 'helpdesk_email',
      fingerprint: 'sha256:xyz',
      window_seconds: 3601,
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('WINDOW_TOO_LARGE');
    expect(res.content[0]!.text).toContain('400');
  });

  it('redis unavailable: returns first_seen: true with note: redis_unavailable', async () => {
    register(
      makeStubStore({
        checkAndSet: async (_org, _src, _fp, window) => ({
          first_seen: true,
          window_seconds: window,
          note: 'redis_unavailable' as const,
        }),
      }),
    );
    mockAuthMe();
    const res = await getTool('ingest_fingerprint_check').handler({
      source: 'bond_webform',
      fingerprint: 'sha256:ignore',
      window_seconds: 60,
    });
    expect(res.isError).toBeUndefined();
    const body = JSON.parse(res.content[0]!.text);
    expect(body.first_seen).toBe(true);
    expect(body.note).toBe('redis_unavailable');
  });

  it('missing org_id from /auth/me → isError', async () => {
    mockAuthMe(null);
    const res = await getTool('ingest_fingerprint_check').handler({
      source: 'bond_webform',
      fingerprint: 'sha256:ignore',
      window_seconds: 60,
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('Unable to resolve caller org_id');
  });
});

// ---------------------------------------------------------------------------
// createFingerprintStore: the WindowTooLargeError threshold is a hard code
// path we can cover without Redis by asking for a too-large window.
// ---------------------------------------------------------------------------

describe('createFingerprintStore window cap (§19 Wave 5)', () => {
  it('throws WindowTooLargeError for > 3600 seconds', async () => {
    const s = createFingerprintStore({
      redisUrl: 'redis://localhost:1', // unreachable, but we never dial
      logger,
    });
    await expect(
      s.checkAndSet(ORG, 'src', 'fp', FINGERPRINT_WINDOW_MAX_SECONDS + 1),
    ).rejects.toBeInstanceOf(WindowTooLargeError);
    await s.close();
  });

  it('throws WindowTooLargeError for non-positive seconds', async () => {
    const s = createFingerprintStore({
      redisUrl: 'redis://localhost:1',
      logger,
    });
    await expect(s.checkAndSet(ORG, 'src', 'fp', 0)).rejects.toBeInstanceOf(
      WindowTooLargeError,
    );
    await s.close();
  });
});
