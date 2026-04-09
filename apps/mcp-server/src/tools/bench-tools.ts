import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/**
 * Helper to make requests to the bench-api service.
 */
function createBenchClient(benchApiUrl: string, api: ApiClient) {
  const baseUrl = benchApiUrl.replace(/\/$/, '');

  async function request(method: string, path: string, body?: unknown) {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

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

export function registerBenchTools(server: McpServer, api: ApiClient, benchApiUrl: string): void {
  const client = createBenchClient(benchApiUrl, api);

  // ===== bench_list_dashboards =====
  server.tool(
    'bench_list_dashboards',
    'List available analytics dashboards for the current organization. Supports filtering by project and visibility.',
    {
      project_id: z.string().uuid().optional().describe('Filter by project ID'),
      visibility: z.enum(['private', 'project', 'organization']).optional().describe('Filter by visibility'),
    },
    async (params) => {
      const result = await client.request('GET', `/dashboards${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing dashboards', result.data);
    },
  );

  // ===== bench_get_dashboard =====
  server.tool(
    'bench_get_dashboard',
    'Get a dashboard with all its widget configurations and layout.',
    {
      id: z.string().uuid().describe('Dashboard ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/dashboards/${id}`);
      return result.ok ? ok(result.data) : err('getting dashboard', result.data);
    },
  );

  // ===== bench_query_widget =====
  server.tool(
    'bench_query_widget',
    'Execute a widget query and return the data results. Returns rows, the generated SQL, and execution time.',
    {
      widget_id: z.string().uuid().describe('Widget ID to query'),
    },
    async ({ widget_id }) => {
      const result = await client.request('POST', `/widgets/${widget_id}/query`);
      return result.ok ? ok(result.data) : err('querying widget', result.data);
    },
  );

  // ===== bench_query_ad_hoc =====
  server.tool(
    'bench_query_ad_hoc',
    'Run a structured query against any registered data source. Returns rows, SQL, and duration. Use bench_list_data_sources to discover available sources and their schemas.',
    {
      data_source: z.string().describe('Product name (e.g., "bam", "bond", "blast")'),
      entity: z.string().describe('Entity name (e.g., "tasks", "deals", "campaigns")'),
      measures: z.array(z.object({
        field: z.string(),
        agg: z.enum(['count', 'sum', 'avg', 'min', 'max']),
        alias: z.string().optional(),
      })).min(1).describe('Measures to aggregate'),
      dimensions: z.array(z.object({
        field: z.string(),
        alias: z.string().optional(),
      })).optional().describe('Dimensions to group by'),
      filters: z.array(z.object({
        field: z.string(),
        op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is_null', 'is_not_null', 'between']),
        value: z.unknown(),
      })).optional().describe('Filters to apply'),
      limit: z.number().int().positive().max(1000).optional().describe('Max rows (default 100)'),
    },
    async ({ data_source, entity, measures, dimensions, filters, limit }) => {
      const result = await client.request('POST', '/query/preview', {
        data_source,
        entity,
        query_config: { measures, dimensions, filters, limit: limit ?? 100 },
      });
      return result.ok ? ok(result.data) : err('running ad-hoc query', result.data);
    },
  );

  // ===== bench_summarize_dashboard =====
  server.tool(
    'bench_summarize_dashboard',
    'Get all widget data from a dashboard for AI summarization. Returns the dashboard metadata and query results for each widget.',
    {
      dashboard_id: z.string().uuid().describe('Dashboard ID to summarize'),
    },
    async ({ dashboard_id }) => {
      // Get dashboard with widgets
      const dashResult = await client.request('GET', `/dashboards/${dashboard_id}`);
      if (!dashResult.ok) return err('getting dashboard for summary', dashResult.data);

      const dashboard = (dashResult.data as any).data;
      const widgetResults: Record<string, unknown> = {};

      // Execute each widget's query
      for (const widget of dashboard.widgets ?? []) {
        const queryResult = await client.request('POST', `/widgets/${widget.id}/query`);
        widgetResults[widget.id] = {
          name: widget.name,
          type: widget.widget_type,
          data_source: `${widget.data_source}.${widget.entity}`,
          data: queryResult.ok ? (queryResult.data as any).data : { error: 'query failed' },
        };
      }

      return ok({
        dashboard: {
          id: dashboard.id,
          name: dashboard.name,
          description: dashboard.description,
          widget_count: dashboard.widgets?.length ?? 0,
        },
        widget_results: widgetResults,
      });
    },
  );

  // ===== bench_detect_anomalies =====
  server.tool(
    'bench_detect_anomalies',
    'Scan recent metrics for anomalies. Queries the specified data source and compares the most recent period against the previous period to detect significant deviations.',
    {
      data_source: z.string().describe('Product name (e.g., "bam", "bond")'),
      entity: z.string().describe('Entity name (e.g., "tasks", "deals")'),
      measure_field: z.string().describe('Field to measure (e.g., "id" for count)'),
      measure_agg: z.enum(['count', 'sum', 'avg']).describe('Aggregation function'),
      days: z.number().int().positive().max(90).optional().describe('Number of days to analyze (default 7)'),
    },
    async ({ data_source, entity, measure_field, measure_agg, days }) => {
      const d = days ?? 7;
      // Current period
      const currentResult = await client.request('POST', '/query/preview', {
        data_source,
        entity,
        query_config: {
          measures: [{ field: measure_field, agg: measure_agg, alias: 'value' }],
          filters: [{ field: 'created_at', op: 'gte', value: new Date(Date.now() - d * 86400000).toISOString() }],
        },
      });

      // Previous period
      const previousResult = await client.request('POST', '/query/preview', {
        data_source,
        entity,
        query_config: {
          measures: [{ field: measure_field, agg: measure_agg, alias: 'value' }],
          filters: [
            { field: 'created_at', op: 'gte', value: new Date(Date.now() - 2 * d * 86400000).toISOString() },
            { field: 'created_at', op: 'lt', value: new Date(Date.now() - d * 86400000).toISOString() },
          ],
        },
      });

      const current = currentResult.ok ? ((currentResult.data as any).data?.rows?.[0]?.value ?? 0) : 0;
      const previous = previousResult.ok ? ((previousResult.data as any).data?.rows?.[0]?.value ?? 0) : 0;
      const change = previous > 0 ? ((Number(current) - Number(previous)) / Number(previous) * 100) : 0;

      return ok({
        data_source: `${data_source}.${entity}`,
        measure: `${measure_agg}(${measure_field})`,
        period_days: d,
        current_period_value: current,
        previous_period_value: previous,
        change_percent: Math.round(change * 10) / 10,
        is_anomaly: Math.abs(change) > 30,
        severity: Math.abs(change) > 50 ? 'high' : Math.abs(change) > 30 ? 'medium' : 'low',
      });
    },
  );

  // ===== bench_generate_report =====
  server.tool(
    'bench_generate_report',
    'Trigger immediate generation and delivery of a scheduled report.',
    {
      report_id: z.string().uuid().describe('Scheduled report ID to trigger'),
    },
    async ({ report_id }) => {
      const result = await client.request('POST', `/reports/${report_id}/send-now`);
      return result.ok ? ok(result.data) : err('generating report', result.data);
    },
  );

  // ===== bench_list_data_sources =====
  server.tool(
    'bench_list_data_sources',
    'List all available data sources and their schemas (measures, dimensions, filters). Use this to discover what data can be queried through Bench.',
    {},
    async () => {
      const result = await client.request('GET', '/data-sources');
      return result.ok ? ok(result.data) : err('listing data sources', result.data);
    },
  );

  // ===== bench_compare_periods =====
  server.tool(
    'bench_compare_periods',
    'Compare metrics between two time periods. Returns values for both periods and the percentage change.',
    {
      data_source: z.string().describe('Product name'),
      entity: z.string().describe('Entity name'),
      measure_field: z.string().describe('Field to measure'),
      measure_agg: z.enum(['count', 'sum', 'avg']).describe('Aggregation function'),
      period1_start: z.string().describe('Start of first period (ISO date)'),
      period1_end: z.string().describe('End of first period (ISO date)'),
      period2_start: z.string().describe('Start of second period (ISO date)'),
      period2_end: z.string().describe('End of second period (ISO date)'),
    },
    async ({ data_source, entity, measure_field, measure_agg, period1_start, period1_end, period2_start, period2_end }) => {
      const q = (start: string, end: string) => client.request('POST', '/query/preview', {
        data_source,
        entity,
        query_config: {
          measures: [{ field: measure_field, agg: measure_agg, alias: 'value' }],
          filters: [
            { field: 'created_at', op: 'gte', value: start },
            { field: 'created_at', op: 'lte', value: end },
          ],
        },
      });

      const [r1, r2] = await Promise.all([
        q(period1_start, period1_end),
        q(period2_start, period2_end),
      ]);

      const v1 = r1.ok ? Number((r1.data as any).data?.rows?.[0]?.value ?? 0) : 0;
      const v2 = r2.ok ? Number((r2.data as any).data?.rows?.[0]?.value ?? 0) : 0;
      const change = v1 > 0 ? ((v2 - v1) / v1 * 100) : 0;

      return ok({
        data_source: `${data_source}.${entity}`,
        measure: `${measure_agg}(${measure_field})`,
        period1: { start: period1_start, end: period1_end, value: v1 },
        period2: { start: period2_start, end: period2_end, value: v2 },
        change_percent: Math.round(change * 10) / 10,
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      });
    },
  );
}
