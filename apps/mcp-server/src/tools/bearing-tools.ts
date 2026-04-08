import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/**
 * Helper to make requests to the bearing-api service.
 * Same pattern as bolt-tools.ts — a lightweight fetch wrapper that targets
 * the bearing-api base URL and forwards the user's auth token.
 */
function createBearingClient(bearingApiUrl: string, api: ApiClient) {
  const baseUrl = bearingApiUrl.replace(/\/$/, '');

  async function request(method: string, path: string, body?: unknown) {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Forward the bearer token from the main API client
    const token = (api as unknown as { token?: string }).token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Forward org context
    const orgId = (api as unknown as { orgId?: string }).orgId;
    if (orgId) {
      headers['X-Org-Id'] = orgId;
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

export function registerBearingTools(server: McpServer, api: ApiClient, bearingApiUrl: string): void {
  const client = createBearingClient(bearingApiUrl, api);

  // ===== PERIODS (2) =====

  server.tool(
    'bearing_periods',
    'List OKR periods with optional filters by status and year.',
    {
      status: z.enum(['planning', 'active', 'completed']).optional().describe('Filter by period status'),
      year: z.number().int().optional().describe('Filter by year'),
    },
    async (params) => {
      const result = await client.request('GET', `/periods${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing periods', result.data);
    },
  );

  server.tool(
    'bearing_period_get',
    'Get a single OKR period with aggregated stats.',
    {
      id: z.string().uuid().describe('Period ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/periods/${id}`);
      return result.ok ? ok(result.data) : err('getting period', result.data);
    },
  );

  // ===== GOALS (4) =====

  server.tool(
    'bearing_goals',
    'List OKR goals with optional filters by period, scope, owner, and status.',
    {
      period_id: z.string().uuid().optional().describe('Filter by period'),
      scope: z.enum(['organization', 'team', 'project', 'individual']).optional().describe('Filter by goal scope'),
      owner_id: z.string().uuid().optional().describe('Filter by goal owner'),
      status: z.enum(['draft', 'on_track', 'at_risk', 'behind', 'achieved', 'missed']).optional().describe('Filter by goal status'),
      limit: z.number().int().positive().max(100).optional().describe('Max results (default 50, max 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/goals${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing goals', result.data);
    },
  );

  server.tool(
    'bearing_goal_get',
    'Get a single goal with its key results and progress details.',
    {
      id: z.string().uuid().describe('Goal ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/goals/${id}`);
      return result.ok ? ok(result.data) : err('getting goal', result.data);
    },
  );

  server.tool(
    'bearing_goal_create',
    'Create a new OKR goal within a period.',
    {
      period_id: z.string().uuid().describe('Period to attach the goal to'),
      title: z.string().max(255).describe('Goal title (max 255 chars)'),
      description: z.string().max(2000).optional().describe('Goal description (max 2000 chars)'),
      scope: z.enum(['organization', 'team', 'project', 'individual']).optional().describe('Goal scope level'),
      project_id: z.string().uuid().optional().describe('Project to scope the goal to (when scope is project)'),
      team_name: z.string().max(100).optional().describe('Team name (when scope is team)'),
      icon: z.string().max(50).optional().describe('Icon identifier'),
      color: z.string().max(20).optional().describe('Color value (hex or named)'),
      owner_id: z.string().uuid().describe('User ID of the goal owner'),
    },
    async (params) => {
      const result = await client.request('POST', '/goals', params);
      return result.ok ? ok(result.data) : err('creating goal', result.data);
    },
  );

  server.tool(
    'bearing_goal_update',
    'Update an existing goal. Provide only the fields to change.',
    {
      id: z.string().uuid().describe('Goal ID'),
      title: z.string().max(255).optional().describe('Updated title'),
      description: z.string().max(2000).optional().describe('Updated description'),
      scope: z.enum(['organization', 'team', 'project', 'individual']).optional().describe('Updated scope'),
      owner_id: z.string().uuid().optional().describe('Updated owner'),
      icon: z.string().max(50).optional().describe('Updated icon'),
      color: z.string().max(20).optional().describe('Updated color'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('PATCH', `/goals/${id}`, body);
      return result.ok ? ok(result.data) : err('updating goal', result.data);
    },
  );

  // ===== KEY RESULTS (3) =====

  server.tool(
    'bearing_kr_create',
    'Create a key result under a goal.',
    {
      goal_id: z.string().uuid().describe('Parent goal ID'),
      title: z.string().max(255).describe('Key result title (max 255 chars)'),
      description: z.string().max(2000).optional().describe('Key result description'),
      metric_type: z.enum(['number', 'percentage', 'currency', 'boolean']).optional().describe('Metric type'),
      target_value: z.number().describe('Target value to achieve'),
      start_value: z.number().optional().describe('Starting value (default 0)'),
      unit: z.string().max(20).optional().describe('Unit label (e.g. "users", "$", "%")'),
      direction: z.enum(['increase', 'decrease']).optional().describe('Whether the metric should increase or decrease'),
      progress_mode: z.enum(['manual', 'linked']).optional().describe('How progress is tracked'),
      owner_id: z.string().uuid().optional().describe('Key result owner (defaults to goal owner)'),
    },
    async ({ goal_id, ...body }) => {
      const result = await client.request('POST', `/goals/${goal_id}/key-results`, body);
      return result.ok ? ok(result.data) : err('creating key result', result.data);
    },
  );

  server.tool(
    'bearing_kr_update',
    'Update a key result value or metadata. When current_value is provided, also records a value check-in.',
    {
      id: z.string().uuid().describe('Key result ID'),
      current_value: z.number().optional().describe('New current value (also posts a value check-in)'),
      title: z.string().max(255).optional().describe('Updated title'),
      target_value: z.number().optional().describe('Updated target value'),
    },
    async ({ id, current_value, ...metaBody }) => {
      // Update metadata if any meta fields provided
      const hasMeta = Object.values(metaBody).some((v) => v !== undefined);
      if (hasMeta) {
        const metaResult = await client.request('PATCH', `/key-results/${id}`, metaBody);
        if (!metaResult.ok) return err('updating key result', metaResult.data);
      }

      // Post value check-in if current_value provided
      if (current_value !== undefined) {
        const valueResult = await client.request('POST', `/key-results/${id}/value`, { value: current_value });
        if (!valueResult.ok) return err('recording key result value', valueResult.data);
        return ok(valueResult.data);
      }

      // If only meta was updated, fetch the updated KR
      const getResult = await client.request('GET', `/key-results/${id}`);
      return getResult.ok ? ok(getResult.data) : err('fetching updated key result', getResult.data);
    },
  );

  server.tool(
    'bearing_kr_link',
    'Link a key result to a Bam entity (epic, project, or task query) for automatic progress tracking.',
    {
      key_result_id: z.string().uuid().describe('Key result ID'),
      link_type: z.enum(['epic', 'project', 'task_query', 'task', 'sprint']).describe('Type of entity to link'),
      target_type: z.enum(['task', 'epic', 'project', 'sprint', 'goal']).describe('Type of target entity'),
      target_id: z.string().uuid().describe('Target entity ID'),
      metadata: z.record(z.unknown()).optional().describe('Optional metadata for this link'),
    },
    async ({ key_result_id, ...body }) => {
      const result = await client.request('POST', `/key-results/${key_result_id}/links`, body);
      return result.ok ? ok(result.data) : err('linking key result', result.data);
    },
  );

  // ===== UPDATES (1) =====

  server.tool(
    'bearing_update_post',
    'Post a status update on a goal.',
    {
      goal_id: z.string().uuid().describe('Goal ID'),
      status: z.enum(['draft', 'on_track', 'at_risk', 'behind', 'achieved', 'missed']).describe('Goal status for this update'),
      body: z.string().max(5000).optional().describe('Update body text (max 5000 chars)'),
    },
    async ({ goal_id, status, body: updateBody }) => {
      const result = await client.request('POST', `/goals/${goal_id}/updates`, { status, body: updateBody });
      return result.ok ? ok(result.data) : err('posting goal update', result.data);
    },
  );

  // ===== REPORTS (2) =====

  server.tool(
    'bearing_report',
    'Generate a period summary, at-risk, or owner report.',
    {
      report_type: z.enum(['period', 'at_risk', 'owner']).describe('Type of report to generate'),
      period_id: z.string().uuid().optional().describe('Period ID (required for period reports)'),
      user_id: z.string().uuid().optional().describe('User ID (required for owner reports)'),
      format: z.enum(['markdown', 'json']).optional().describe('Output format (default json)'),
    },
    async ({ report_type, period_id, user_id, format }) => {
      let path: string;
      const qs = buildQs({ format });

      switch (report_type) {
        case 'period':
          if (!period_id) {
            return err('generating report', { message: 'period_id is required for period reports' });
          }
          path = `/reports/period/${period_id}${qs}`;
          break;
        case 'at_risk':
          path = `/reports/at-risk${qs}`;
          break;
        case 'owner':
          if (!user_id) {
            return err('generating report', { message: 'user_id is required for owner reports' });
          }
          path = `/reports/owner/${user_id}${qs}`;
          break;
      }

      const result = await client.request('GET', path);
      return result.ok ? ok(result.data) : err('generating report', result.data);
    },
  );

  server.tool(
    'bearing_at_risk',
    'Quick check: list all at-risk or behind goals across the organization.',
    {},
    async () => {
      const result = await client.request('GET', '/reports/at-risk');
      return result.ok ? ok(result.data) : err('fetching at-risk goals', result.data);
    },
  );
}
