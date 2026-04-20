import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../src/middleware/api-client.js';
import { registerAgentPolicyTools } from '../src/tools/agent-policy-tools.js';

/**
 * agent_policy_* MCP tool tests (AGENTIC_TODO §15 Wave 5).
 *
 * Covers registration + happy path per tool. Behavior of the underlying
 * check/set/list endpoints is exercised in apps/api/test/agent-policies.test.ts;
 * these tests verify the wire shape and error propagation on the MCP side.
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

function mockApiError(status: number, data: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: false, status, json: async () => data });
}

const AGENT_USER = '99999999-9999-9999-9999-999999999999';
const HUMAN_USER = '88888888-8888-8888-8888-888888888888';
const ORG_A = '11111111-1111-1111-1111-111111111111';

describe('agent-policy MCP tools', () => {
  let tools: Map<string, RegisteredTool>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new ApiClient('http://localhost:4000', 'test-token', logger);
    const mock = createMockServer();
    tools = mock.tools;
    registerAgentPolicyTools(mock.server, api);
  });

  function getTool(name: string): RegisteredTool {
    const t = tools.get(name);
    if (!t) throw new Error(`Tool "${name}" not registered`);
    return t;
  }

  it('registers agent_policy_get, agent_policy_set, agent_policy_list', () => {
    expect(tools.has('agent_policy_get')).toBe(true);
    expect(tools.has('agent_policy_set')).toBe(true);
    expect(tools.has('agent_policy_list')).toBe(true);
  });

  describe('agent_policy_get', () => {
    it('GETs /v1/agent-policies/:id and surfaces the row', async () => {
      mockApiOk({
        data: {
          agent_user_id: AGENT_USER,
          org_id: ORG_A,
          enabled: true,
          allowed_tools: ['banter_*'],
          channel_subscriptions: [],
          rate_limit_override: null,
          notes: null,
          updated_at: '2026-04-18T00:00:00Z',
          updated_by: HUMAN_USER,
          updated_by_user: { id: HUMAN_USER, name: 'Eddie' },
        },
      });
      const res = await getTool('agent_policy_get').handler({ agent_user_id: AGENT_USER });
      expect(res.isError).toBeUndefined();
      const body = JSON.parse(res.content[0]!.text);
      expect(body.data.allowed_tools).toEqual(['banter_*']);
      expect(mockFetch.mock.calls[0]![0]).toContain(`/v1/agent-policies/${AGENT_USER}`);
    });

    it('surfaces 404 as isError', async () => {
      mockApiError(404, { error: { code: 'NOT_FOUND', message: 'Agent policy not found' } });
      const res = await getTool('agent_policy_get').handler({ agent_user_id: AGENT_USER });
      expect(res.isError).toBe(true);
      expect(res.content[0]!.text).toContain('NOT_FOUND');
    });
  });

  describe('agent_policy_set', () => {
    it('POSTs patch to /v1/agent-policies/:id and surfaces confirmation_required', async () => {
      mockApiOk({
        data: {
          agent_user_id: AGENT_USER,
          org_id: ORG_A,
          enabled: false,
          allowed_tools: ['*'],
          channel_subscriptions: [],
          rate_limit_override: null,
          notes: null,
          updated_at: '2026-04-18T00:00:00Z',
          updated_by: HUMAN_USER,
          updated_by_user: { id: HUMAN_USER, name: 'Eddie' },
        },
        confirmation_required: true,
      });
      const res = await getTool('agent_policy_set').handler({
        agent_user_id: AGENT_USER,
        patch: { enabled: false },
      });
      expect(res.isError).toBeUndefined();
      const body = JSON.parse(res.content[0]!.text);
      expect(body.confirmation_required).toBe(true);
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toContain(`/v1/agent-policies/${AGENT_USER}`);
      expect(call[1].method).toBe('POST');
      const parsedBody = JSON.parse(call[1].body as string);
      expect(parsedBody).toEqual({ enabled: false });
    });

    it('surfaces 400 NOT_AN_AGENT as isError', async () => {
      mockApiError(400, { error: { code: 'NOT_AN_AGENT', message: 'Target user is not an agent or service account' } });
      const res = await getTool('agent_policy_set').handler({
        agent_user_id: AGENT_USER,
        patch: { enabled: false },
      });
      expect(res.isError).toBe(true);
      expect(res.content[0]!.text).toContain('NOT_AN_AGENT');
    });
  });

  describe('agent_policy_list', () => {
    it('forwards enabled_only and returns the list', async () => {
      mockApiOk({
        data: [
          {
            agent_user_id: AGENT_USER,
            agent_name: 'banter-listener',
            enabled: true,
            allowed_tool_count: 3,
            last_heartbeat_at: '2026-04-18T10:00:00Z',
            updated_at: '2026-04-18T00:00:00Z',
          },
        ],
      });
      const res = await getTool('agent_policy_list').handler({ enabled_only: true });
      expect(res.isError).toBeUndefined();
      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('/v1/agent-policies');
      expect(url).toContain('enabled_only=true');
      const body = JSON.parse(res.content[0]!.text);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].agent_name).toBe('banter-listener');
    });

    it('omits query params when none are provided', async () => {
      mockApiOk({ data: [] });
      await getTool('agent_policy_list').handler({});
      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url.endsWith('/v1/agent-policies')).toBe(true);
    });
  });
});
