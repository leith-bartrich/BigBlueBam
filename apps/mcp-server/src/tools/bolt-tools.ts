import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/**
 * Helper to make requests to the bolt-api service.
 * Same pattern as brief-tools.ts — a lightweight fetch wrapper that targets
 * the bolt-api base URL and forwards the user's auth token.
 */
function createBoltClient(boltApiUrl: string, api: ApiClient) {
  const baseUrl = boltApiUrl.replace(/\/$/, '');

  async function request(method: string, path: string, body?: unknown) {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Forward the bearer token from the main API client
    const token = (api as unknown as { token?: string }).token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }

  return { request };
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(label: string, data: unknown) {
  return {
    content: [{ type: 'text' as const, text: `Error ${label}: ${JSON.stringify(data)}` }],
    isError: true as const,
  };
}

function buildQs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export function registerBoltTools(server: McpServer, api: ApiClient, boltApiUrl: string): void {
  const client = createBoltClient(boltApiUrl, api);

  // ===== AUTOMATIONS CRUD (7) =====

  server.tool(
    'bolt_list',
    'List workflow automations with optional filters and pagination.',
    {
      project_id: z.string().uuid().optional().describe('Filter by project'),
      trigger_source: z.enum(['bam', 'banter', 'beacon', 'brief', 'helpdesk', 'schedule', 'bond', 'blast', 'board', 'bench', 'bearing', 'bill', 'book', 'blank']).optional().describe('Filter by trigger source'),
      enabled: z.boolean().optional().describe('Filter by enabled state'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(100).optional().describe('Page size (default 50, max 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/automations${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing automations', result.data);
    },
  );

  server.tool(
    'bolt_get',
    'Get a single automation with its conditions and actions.',
    {
      id: z.string().uuid().describe('Automation ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/automations/${id}`);
      return result.ok ? ok(result.data) : err('getting automation', result.data);
    },
  );

  server.tool(
    'bolt_create',
    'Create a new workflow automation with trigger, conditions, and actions.',
    {
      name: z.string().max(255).describe('Automation name (max 255 chars)'),
      description: z.string().max(2000).optional().describe('Description (max 2000 chars)'),
      project_id: z.string().uuid().optional().describe('Project to scope the automation to'),
      trigger_source: z.enum(['bam', 'banter', 'beacon', 'brief', 'helpdesk', 'schedule', 'bond', 'blast', 'board', 'bench', 'bearing', 'bill', 'book', 'blank']).describe('Source system that fires the trigger'),
      trigger_event: z.string().max(60).describe('Event name within the source (max 60 chars)'),
      trigger_filter: z.record(z.unknown()).optional().describe('Optional filter object narrowing which events match'),
      conditions: z.array(z.record(z.unknown())).optional().describe('Array of condition objects that must all pass'),
      actions: z.array(z.record(z.unknown())).min(1).describe('Array of action objects to execute (min 1)'),
      max_executions_per_hour: z.number().int().positive().optional().describe('Rate limit per hour (default 100)'),
      cooldown_seconds: z.number().int().min(0).optional().describe('Minimum seconds between executions (default 0)'),
      enabled: z.boolean().optional().describe('Whether the automation is active (default true)'),
    },
    async (params) => {
      const result = await client.request('POST', '/automations', params);
      return result.ok ? ok(result.data) : err('creating automation', result.data);
    },
  );

  server.tool(
    'bolt_update',
    'Update an existing automation. Provide only the fields to change.',
    {
      id: z.string().uuid().describe('Automation ID'),
      name: z.string().max(255).optional().describe('Updated name'),
      description: z.string().max(2000).optional().describe('Updated description'),
      trigger_source: z.enum(['bam', 'banter', 'beacon', 'brief', 'helpdesk', 'schedule', 'bond', 'blast', 'board', 'bench', 'bearing', 'bill', 'book', 'blank']).optional().describe('Updated trigger source'),
      trigger_event: z.string().max(60).optional().describe('Updated trigger event'),
      trigger_filter: z.record(z.unknown()).optional().describe('Updated trigger filter'),
      conditions: z.array(z.record(z.unknown())).optional().describe('Updated conditions array'),
      actions: z.array(z.record(z.unknown())).optional().describe('Updated actions array'),
      enabled: z.boolean().optional().describe('Enable or disable'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('PUT', `/automations/${id}`, body);
      return result.ok ? ok(result.data) : err('updating automation', result.data);
    },
  );

  server.tool(
    'bolt_enable',
    'Enable a workflow automation.',
    {
      id: z.string().uuid().describe('Automation ID'),
    },
    async ({ id }) => {
      const result = await client.request('POST', `/automations/${id}/enable`);
      return result.ok ? ok(result.data) : err('enabling automation', result.data);
    },
  );

  server.tool(
    'bolt_disable',
    'Disable a workflow automation.',
    {
      id: z.string().uuid().describe('Automation ID'),
    },
    async ({ id }) => {
      const result = await client.request('POST', `/automations/${id}/disable`);
      return result.ok ? ok(result.data) : err('disabling automation', result.data);
    },
  );

  server.tool(
    'bolt_delete',
    'Delete a workflow automation.',
    {
      id: z.string().uuid().describe('Automation ID'),
    },
    async ({ id }) => {
      const result = await client.request('DELETE', `/automations/${id}`);
      return result.ok ? ok(result.data) : err('deleting automation', result.data);
    },
  );

  // ===== TESTING (1) =====

  server.tool(
    'bolt_test',
    'Test-fire an automation with a simulated event payload.',
    {
      id: z.string().uuid().describe('Automation ID to test'),
      event: z.record(z.unknown()).describe('Simulated event payload object'),
    },
    async ({ id, event }) => {
      const result = await client.request('POST', `/automations/${id}/test`, { event });
      return result.ok ? ok(result.data) : err('testing automation', result.data);
    },
  );

  // ===== EXECUTIONS (2) =====

  server.tool(
    'bolt_executions',
    'List execution history for an automation.',
    {
      automation_id: z.string().uuid().describe('Automation ID'),
      status: z.enum(['running', 'success', 'partial', 'failed', 'skipped']).optional().describe('Filter by execution status'),
      limit: z.number().int().positive().max(100).optional().describe('Max results (default 50, max 100)'),
    },
    async ({ automation_id, ...rest }) => {
      const result = await client.request('GET', `/automations/${automation_id}/executions${buildQs(rest)}`);
      return result.ok ? ok(result.data) : err('listing executions', result.data);
    },
  );

  server.tool(
    'bolt_execution_detail',
    'Get detailed information about a single execution, including action results.',
    {
      id: z.string().uuid().describe('Execution ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/executions/${id}`);
      return result.ok ? ok(result.data) : err('getting execution detail', result.data);
    },
  );

  // ===== DISCOVERY (2) =====

  server.tool(
    'bolt_events',
    'List available trigger events, optionally filtered by source.',
    {
      source: z.enum(['bam', 'banter', 'beacon', 'brief', 'helpdesk', 'schedule', 'bond', 'blast', 'board', 'bench', 'bearing', 'bill', 'book', 'blank']).optional().describe('Filter events by source system'),
    },
    async ({ source }) => {
      const path = source ? `/events/${source}` : '/events';
      const result = await client.request('GET', path);
      return result.ok ? ok(result.data) : err('listing events', result.data);
    },
  );

  server.tool(
    'bolt_actions',
    'List available MCP tools that can be used as automation actions.',
    {},
    async () => {
      const result = await client.request('GET', '/actions');
      return result.ok ? ok(result.data) : err('listing actions', result.data);
    },
  );
}
