// §1 Wave 5 banter subs - MCP tool tests.
//
// Verifies:
//   - banter_subscribe_pattern / banter_unsubscribe_pattern /
//     banter_list_subscriptions are all registered.
//   - Each tool forwards to the correct banter-api path with the
//     expected method, body, and query string.
//   - Error responses surface as isError: true.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../src/middleware/api-client.js';
import { registerBanterSubscriptionTools } from '../src/tools/banter-subscription-tools.js';

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

function mockApiError(status: number, data: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: false, status, json: async () => data });
}

const CHANNEL_ID = '11111111-1111-1111-1111-111111111111';
const SUB_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const BANTER_URL = 'http://banter-api:4002';

describe('banter-subscription MCP tools', () => {
  let tools: Map<string, RegisteredTool>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new ApiClient('http://localhost:4000', 'test-token', logger);
    const mock = createMockServer();
    tools = mock.tools;
    registerBanterSubscriptionTools(mock.server, api, BANTER_URL);
  });

  function getTool(name: string): RegisteredTool {
    const t = tools.get(name);
    if (!t) throw new Error(`Tool "${name}" not registered`);
    return t;
  }

  it('registers banter_subscribe_pattern, banter_unsubscribe_pattern, banter_list_subscriptions', () => {
    expect(tools.has('banter_subscribe_pattern')).toBe(true);
    expect(tools.has('banter_unsubscribe_pattern')).toBe(true);
    expect(tools.has('banter_list_subscriptions')).toBe(true);
  });

  describe('banter_subscribe_pattern', () => {
    it('POSTs to /v1/channels/:id/agent-subscriptions with the pattern body', async () => {
      mockApiOk({
        data: {
          subscription_id: SUB_ID,
          effective: true,
        },
      });
      const res = await getTool('banter_subscribe_pattern').handler({
        channel_id: CHANNEL_ID,
        pattern: { kind: 'interrogative' },
      });
      expect(res.isError).toBeUndefined();
      const body = JSON.parse(res.content[0]!.text);
      expect(body.data.subscription_id).toBe(SUB_ID);
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toBe(`${BANTER_URL}/v1/channels/${CHANNEL_ID}/agent-subscriptions`);
      expect(call[1].method).toBe('POST');
      const parsed = JSON.parse(call[1].body as string);
      expect(parsed.pattern).toEqual({ kind: 'interrogative' });
      expect(parsed.rate_limit_per_hour).toBeUndefined();
    });

    it('forwards subscriber_user_id and rate_limit_per_hour when supplied', async () => {
      mockApiOk({ data: { subscription_id: SUB_ID, effective: true } });
      await getTool('banter_subscribe_pattern').handler({
        channel_id: CHANNEL_ID,
        subscriber_user_id: USER_ID,
        pattern: { kind: 'keyword', terms: ['deploy'], mode: 'any' },
        rate_limit_per_hour: 60,
      });
      const call = mockFetch.mock.calls[0]!;
      const parsed = JSON.parse(call[1].body as string);
      expect(parsed.subscriber_user_id).toBe(USER_ID);
      expect(parsed.rate_limit_per_hour).toBe(60);
      expect(parsed.pattern.kind).toBe('keyword');
    });

    it('surfaces channel_policy_disallow effective:false as a normal response', async () => {
      mockApiOk({
        data: {
          subscription_id: SUB_ID,
          effective: false,
          reason: 'channel_policy_disallow',
        },
      });
      const res = await getTool('banter_subscribe_pattern').handler({
        channel_id: CHANNEL_ID,
        pattern: { kind: 'interrogative' },
      });
      expect(res.isError).toBeUndefined();
      const body = JSON.parse(res.content[0]!.text);
      expect(body.data.effective).toBe(false);
      expect(body.data.reason).toBe('channel_policy_disallow');
    });

    it('surfaces 403 REGEX_ADMIN_ONLY as isError', async () => {
      mockApiError(403, {
        error: {
          code: 'REGEX_ADMIN_ONLY',
          message: 'regex patterns are admin-only',
        },
      });
      const res = await getTool('banter_subscribe_pattern').handler({
        channel_id: CHANNEL_ID,
        pattern: { kind: 'regex', pattern: 'foo' },
      });
      expect(res.isError).toBe(true);
      expect(res.content[0]!.text).toContain('REGEX_ADMIN_ONLY');
    });
  });

  describe('banter_unsubscribe_pattern', () => {
    it('DELETEs /v1/agent-subscriptions/:sid and returns disabled_at', async () => {
      mockApiOk({
        data: {
          subscription_id: SUB_ID,
          disabled_at: '2026-04-18T00:00:00Z',
        },
      });
      const res = await getTool('banter_unsubscribe_pattern').handler({
        subscription_id: SUB_ID,
      });
      expect(res.isError).toBeUndefined();
      const body = JSON.parse(res.content[0]!.text);
      expect(body.data.disabled_at).toBe('2026-04-18T00:00:00Z');
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toBe(`${BANTER_URL}/v1/agent-subscriptions/${SUB_ID}`);
      expect(call[1].method).toBe('DELETE');
    });

    it('surfaces 404 as isError', async () => {
      mockApiError(404, { error: { code: 'NOT_FOUND', message: 'not found' } });
      const res = await getTool('banter_unsubscribe_pattern').handler({
        subscription_id: SUB_ID,
      });
      expect(res.isError).toBe(true);
      expect(res.content[0]!.text).toContain('NOT_FOUND');
    });
  });

  describe('banter_list_subscriptions', () => {
    it('GETs /v1/agent-subscriptions with no query by default', async () => {
      mockApiOk({ data: [] });
      await getTool('banter_list_subscriptions').handler({});
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toBe(`${BANTER_URL}/v1/agent-subscriptions`);
      expect(call[1].method).toBe('GET');
    });

    it('adds channel_id to the query string when supplied', async () => {
      mockApiOk({ data: [] });
      await getTool('banter_list_subscriptions').handler({ channel_id: CHANNEL_ID });
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toContain(`channel_id=${CHANNEL_ID}`);
    });

    it('returns the server response as JSON', async () => {
      mockApiOk({
        data: [
          {
            id: SUB_ID,
            channel_id: CHANNEL_ID,
            pattern_spec: { kind: 'interrogative' },
            rate_limit_per_hour: 30,
            match_count: 0,
            last_matched_at: null,
            opted_in_at: '2026-04-18T00:00:00Z',
            created_at: '2026-04-18T00:00:00Z',
          },
        ],
      });
      const res = await getTool('banter_list_subscriptions').handler({});
      expect(res.isError).toBeUndefined();
      const body = JSON.parse(res.content[0]!.text);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(SUB_ID);
    });
  });
});
