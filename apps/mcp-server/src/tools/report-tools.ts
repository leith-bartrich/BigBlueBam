import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

export function registerReportTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'get_velocity_report',
    'Get velocity report showing story points completed across recent sprints',
    {
      project_id: z.string().uuid().describe('The project ID'),
      last_n_sprints: z.number().int().positive().max(50).optional().describe('Number of recent sprints to include (default 5)'),
    },
    async ({ project_id, last_n_sprints }) => {
      const params = new URLSearchParams();
      if (last_n_sprints) params.set('last_n_sprints', String(last_n_sprints));

      const qs = params.toString();
      const result = await api.get(`/projects/${project_id}/reports/velocity${qs ? `?${qs}` : ''}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting velocity report: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'get_burndown',
    'Get burndown chart data for a specific sprint',
    {
      sprint_id: z.string().uuid().describe('The sprint ID'),
    },
    async ({ sprint_id }) => {
      const result = await api.get(`/sprints/${sprint_id}/report`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting burndown: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'get_cumulative_flow',
    'Get cumulative flow diagram data for a project over a date range',
    {
      project_id: z.string().uuid().describe('The project ID'),
      from_date: z.string().describe('Start date (ISO 8601)'),
      to_date: z.string().describe('End date (ISO 8601)'),
    },
    async ({ project_id, from_date, to_date }) => {
      const params = new URLSearchParams();
      params.set('from_date', from_date);
      params.set('to_date', to_date);

      const result = await api.get(`/projects/${project_id}/reports/cfd?${params.toString()}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting cumulative flow data: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'get_overdue_tasks',
    'Get a report of all overdue tasks in a project',
    {
      project_id: z.string().uuid().describe('The project ID'),
    },
    async ({ project_id }) => {
      const result = await api.get(`/projects/${project_id}/reports/overdue`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting overdue tasks: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'get_workload',
    'Get workload distribution report showing task counts and story points per team member',
    {
      project_id: z.string().uuid().describe('The project ID'),
    },
    async ({ project_id }) => {
      const result = await api.get(`/projects/${project_id}/reports/workload`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting workload report: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'get_status_distribution',
    'Get status distribution report showing task counts per phase/status',
    {
      project_id: z.string().uuid().describe('The project ID'),
    },
    async ({ project_id }) => {
      const result = await api.get(`/projects/${project_id}/reports/status-distribution`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting status distribution: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
