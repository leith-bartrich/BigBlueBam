import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from '../src/middleware/api-client.js';
import {
  attachPolicyGate,
  buildPolicyDenialResult,
  createPolicyGate,
  registerTool,
  ALWAYS_PERMITTED_TOOLS,
} from '../src/lib/register-tool.js';

/**
 * PolicyGate + register-tool wrapper tests (AGENTIC_TODO §15 Wave 5).
 *
 * These exercise the fail-closed wrapper that gates every tool invocation by
 * a service-account caller. The gate is session-scoped: one gate per McpServer
 * (see apps/mcp-server/src/server.ts). Tests build a mock server, attach a
 * gate built against a mock ApiClient, and drive the tool handler directly.
 */

const logger = pino({ level: 'silent' });

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Minimal mock MCP server that stores the last handler registered per name.
type ToolHandler = (args: Record<string, unknown>) => Promise<any>;

function createMockServer(): { server: McpServer; tools: Map<string, ToolHandler> } {
  const tools = new Map<string, ToolHandler>();
  const server = {
    tool: (name: string, _description: string, _schema: unknown, handler: ToolHandler) => {
      tools.set(name, handler);
    },
  } as unknown as McpServer;
  return { server, tools };
}

function mockMe(id: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ data: { id } }),
  });
}

function mockUserKind(id: string, kind: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ data: { id, kind } }),
  });
}

function mockCheckDecision(decision: Record<string, unknown>) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ data: decision }),
  });
}

function mockApiFail(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: false, status, json: async () => body });
}

const AGENT_ID = '99999999-9999-9999-9999-999999999999';
const HUMAN_ID = '88888888-8888-8888-8888-888888888888';

function registerSampleTool(
  server: McpServer,
  name: string,
  body: () => unknown,
): void {
  registerTool(server, {
    name,
    description: `test ${name}`,
    input: {},
    returns: z.object({}).passthrough(),
    handler: async () => ({
      content: [{ type: 'text', text: JSON.stringify(body()) }],
    }),
  });
}

describe('buildPolicyDenialResult', () => {
  it('shapes AGENT_DISABLED with contact', () => {
    const r = buildPolicyDenialResult('banter_post_message', {
      allowed: false,
      reason: 'AGENT_DISABLED',
      agent_user_id: AGENT_ID,
      disabled_at: '2026-04-18T00:00:00Z',
      contact: 'Eddie',
    });
    expect(r.isError).toBe(true);
    const payload = JSON.parse(r.content[0]!.text);
    expect(payload.error.code).toBe('AGENT_DISABLED');
    expect(payload.error.agent_user_id).toBe(AGENT_ID);
    expect(payload.error.disabled_at).toBe('2026-04-18T00:00:00Z');
    expect(payload.error.contact).toBe('Eddie');
    expect(payload.error.message).toContain('disabled');
  });

  it('shapes TOOL_NOT_ALLOWED with tool name in the message', () => {
    const r = buildPolicyDenialResult('bond_get_deal', {
      allowed: false,
      reason: 'TOOL_NOT_ALLOWED',
      agent_user_id: AGENT_ID,
      disabled_at: null,
      contact: 'Eddie',
    });
    expect(r.isError).toBe(true);
    const payload = JSON.parse(r.content[0]!.text);
    expect(payload.error.code).toBe('TOOL_NOT_ALLOWED');
    expect(payload.error.message).toContain("'bond_get_deal'");
  });
});

describe('ALWAYS_PERMITTED_TOOLS', () => {
  it('covers get_server_info, get_me, agent_heartbeat', () => {
    expect(ALWAYS_PERMITTED_TOOLS.has('get_server_info')).toBe(true);
    expect(ALWAYS_PERMITTED_TOOLS.has('get_me')).toBe(true);
    expect(ALWAYS_PERMITTED_TOOLS.has('agent_heartbeat')).toBe(true);
    expect(ALWAYS_PERMITTED_TOOLS.has('banter_post_message')).toBe(false);
  });
});

describe('register-tool PolicyGate wrapper', () => {
  let server: McpServer;
  let tools: Map<string, ToolHandler>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    const mock = createMockServer();
    server = mock.server;
    tools = mock.tools;
    api = new ApiClient('http://localhost:4000', 'test-token', logger);
  });

  it('runs the handler unchanged when NO gate is attached (legacy behavior)', async () => {
    registerSampleTool(server, 'banter_post_message', () => ({ ok: true }));
    const handler = tools.get('banter_post_message')!;
    const result = await handler({});
    expect(result.content[0].text).toContain('"ok":true');
  });

  it('allows a human caller regardless of allowed_tools', async () => {
    const gate = createPolicyGate({ apiClient: api, logger, sessionId: 's1' });
    attachPolicyGate(server, gate);
    registerSampleTool(server, 'banter_post_message', () => ({ ok: true }));

    // Gate will call /auth/me and /users/:id once on first invocation.
    mockMe(HUMAN_ID);
    mockUserKind(HUMAN_ID, 'human');

    const handler = tools.get('banter_post_message')!;
    const result = await handler({});
    expect(result.content[0].text).toContain('"ok":true');
    // No check endpoint call for humans.
    const urls = mockFetch.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes('/check?tool='))).toBe(false);
  });

  it('always permits core tools even for a service caller', async () => {
    const gate = createPolicyGate({ apiClient: api, logger, sessionId: 's2' });
    attachPolicyGate(server, gate);
    registerSampleTool(server, 'get_server_info', () => ({ name: 'BigBlueBam' }));
    registerSampleTool(server, 'get_me', () => ({ id: AGENT_ID }));
    registerSampleTool(server, 'agent_heartbeat', () => ({ ok: true }));

    // No identity probe should be triggered because ALWAYS_PERMITTED_TOOLS
    // short-circuits the gate BEFORE resolving caller kind.
    const info = await tools.get('get_server_info')!({});
    const me = await tools.get('get_me')!({});
    const hb = await tools.get('agent_heartbeat')!({});
    expect(info.content[0].text).toContain('BigBlueBam');
    expect(me.content[0].text).toContain(AGENT_ID);
    expect(hb.content[0].text).toContain('"ok":true');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('runs a non-core tool for a service caller when the /check endpoint allows it', async () => {
    const gate = createPolicyGate({ apiClient: api, logger, sessionId: 's3' });
    attachPolicyGate(server, gate);
    registerSampleTool(server, 'banter_post_message', () => ({ posted: true }));

    // Identity resolution (once) + check decision
    mockMe(AGENT_ID);
    mockUserKind(AGENT_ID, 'service');
    mockCheckDecision({ allowed: true });

    const result = await tools.get('banter_post_message')!({});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('"posted":true');
  });

  it('fail-closes with TOOL_NOT_ALLOWED when the check endpoint denies', async () => {
    const gate = createPolicyGate({ apiClient: api, logger, sessionId: 's4' });
    attachPolicyGate(server, gate);
    registerSampleTool(server, 'banter_post_message', () => ({ posted: true }));

    mockMe(AGENT_ID);
    mockUserKind(AGENT_ID, 'service');
    mockCheckDecision({
      allowed: false,
      reason: 'TOOL_NOT_ALLOWED',
      agent_user_id: AGENT_ID,
      disabled_at: null,
      contact: 'Eddie',
    });

    const result = await tools.get('banter_post_message')!({});
    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.error.code).toBe('TOOL_NOT_ALLOWED');
    expect(payload.error.contact).toBe('Eddie');
  });

  it('fail-closes with AGENT_DISABLED when the check endpoint reports disabled', async () => {
    const gate = createPolicyGate({ apiClient: api, logger, sessionId: 's5' });
    attachPolicyGate(server, gate);
    registerSampleTool(server, 'banter_post_message', () => ({ posted: true }));

    mockMe(AGENT_ID);
    mockUserKind(AGENT_ID, 'service');
    mockCheckDecision({
      allowed: false,
      reason: 'AGENT_DISABLED',
      agent_user_id: AGENT_ID,
      disabled_at: '2026-04-18T00:00:00Z',
      contact: 'Eddie',
    });

    const result = await tools.get('banter_post_message')!({});
    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.error.code).toBe('AGENT_DISABLED');
    expect(payload.error.disabled_at).toBe('2026-04-18T00:00:00Z');
  });

  it('fail-closes with AGENT_DISABLED when caller identity resolves to unknown', async () => {
    const gate = createPolicyGate({ apiClient: api, logger, sessionId: 's6' });
    attachPolicyGate(server, gate);
    registerSampleTool(server, 'banter_post_message', () => ({ posted: true }));

    // /auth/me returns 401 -> caller.id null -> unknown
    mockApiFail(401, { error: { code: 'UNAUTHORIZED' } });

    const result = await tools.get('banter_post_message')!({});
    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.error.code).toBe('AGENT_DISABLED');
  });

  it('fail-closes when /check returns a non-2xx response', async () => {
    const gate = createPolicyGate({ apiClient: api, logger, sessionId: 's7' });
    attachPolicyGate(server, gate);
    registerSampleTool(server, 'banter_post_message', () => ({ posted: true }));

    mockMe(AGENT_ID);
    mockUserKind(AGENT_ID, 'service');
    mockApiFail(500, { error: { code: 'INTERNAL_ERROR' } });

    const result = await tools.get('banter_post_message')!({});
    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.error.code).toBe('AGENT_DISABLED');
  });

  it('caches decisions per tool within TTL', async () => {
    const gate = createPolicyGate({
      apiClient: api,
      logger,
      sessionId: 's8',
      ttlMs: 30_000,
    });
    attachPolicyGate(server, gate);
    registerSampleTool(server, 'banter_post_message', () => ({ posted: true }));

    // First invocation: identity + check endpoint
    mockMe(AGENT_ID);
    mockUserKind(AGENT_ID, 'service');
    mockCheckDecision({ allowed: true });

    await tools.get('banter_post_message')!({});
    const callsAfterFirst = mockFetch.mock.calls.length;

    // Second invocation: should hit cache, NO new fetch calls (identity and
    // decision both cached under TTL).
    await tools.get('banter_post_message')!({});
    expect(mockFetch.mock.calls.length).toBe(callsAfterFirst);
  });

  it('invalidate() drops the decision cache for the matching agent_user_id', async () => {
    const gate = createPolicyGate({
      apiClient: api,
      logger,
      sessionId: 's9',
      ttlMs: 30_000,
    });
    attachPolicyGate(server, gate);
    registerSampleTool(server, 'banter_post_message', () => ({ posted: true }));

    // First call: identity (2 fetches) + allow decision
    mockMe(AGENT_ID);
    mockUserKind(AGENT_ID, 'service');
    mockCheckDecision({ allowed: true });
    await tools.get('banter_post_message')!({});

    // Invalidate our agent's cache entry. Identity is NOT dropped (same
    // agent), but decisions are.
    gate.invalidate(AGENT_ID);

    // Second call should re-fetch the decision (identity still cached).
    mockCheckDecision({
      allowed: false,
      reason: 'AGENT_DISABLED',
      agent_user_id: AGENT_ID,
      disabled_at: '2026-04-18T00:00:00Z',
      contact: 'Eddie',
    });
    const result = await tools.get('banter_post_message')!({});
    expect(result.isError).toBe(true);
  });
});
