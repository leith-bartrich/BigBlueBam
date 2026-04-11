import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { registerTool } from '../lib/register-tool.js';

export function registerReportTools(server: McpServer, api: ApiClient): void {
  registerTool(server, {
    name: 'get_velocity_report',
    description: 'Get velocity report showing story points completed across recent sprints',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
      last_n_sprints: z.number().int().positive().max(50).optional().describe('Number of recent sprints to include (default 5)'),
    },
    returns: z.object({
      sprints: z.array(z.object({
        sprint_id: z.string().uuid(),
        sprint_name: z.string(),
        completed_points: z.number(),
        total_points: z.number(),
      }).passthrough()),
      average_velocity: z.number().optional(),
    }).passthrough(),
    handler: async ({ project_id, last_n_sprints }) => {
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
  });

  registerTool(server, {
    name: 'get_burndown',
    description: 'Get burndown chart data for a specific sprint',
    input: {
      sprint_id: z.string().uuid().describe('The sprint ID'),
    },
    returns: z.object({
      sprint_id: z.string().uuid(),
      data_points: z.array(z.object({ date: z.string(), remaining_points: z.number() })).optional(),
      ideal_line: z.array(z.object({ date: z.string(), points: z.number() })).optional(),
    }).passthrough(),
    handler: async ({ sprint_id }) => {
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
  });

  registerTool(server, {
    name: 'get_cumulative_flow',
    description: 'Get cumulative flow diagram data for a project over a date range',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
      from_date: z.string().describe('Start date (ISO 8601)'),
      to_date: z.string().describe('End date (ISO 8601)'),
    },
    returns: z.object({
      dates: z.array(z.string()).optional(),
      series: z.array(z.object({ state: z.string(), counts: z.array(z.number()) })).optional(),
    }).passthrough(),
    handler: async ({ project_id, from_date, to_date }) => {
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
  });

  registerTool(server, {
    name: 'get_overdue_tasks',
    description: 'Get a report of all overdue tasks in a project',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
    },
    returns: z.object({
      data: z.array(z.object({
        id: z.string().uuid(),
        title: z.string(),
        due_date: z.string().optional(),
        days_overdue: z.number().optional(),
        assignee_id: z.string().uuid().nullable().optional(),
      }).passthrough()),
    }),
    handler: async ({ project_id }) => {
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
  });

  registerTool(server, {
    name: 'get_workload',
    description: 'Get workload distribution report showing task counts and story points per team member',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
    },
    returns: z.object({
      data: z.array(z.object({
        user_id: z.string().uuid(),
        display_name: z.string().optional(),
        task_count: z.number(),
        total_points: z.number().optional(),
      }).passthrough()),
    }),
    handler: async ({ project_id }) => {
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
  });

  registerTool(server, {
    name: 'get_status_distribution',
    description: 'Get status distribution report showing task counts per phase/status',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
    },
    returns: z.object({
      data: z.array(z.object({
        phase_id: z.string().uuid().optional(),
        phase_name: z.string().optional(),
        state_id: z.string().uuid().optional(),
        state_name: z.string().optional(),
        count: z.number(),
      }).passthrough()),
    }),
    handler: async ({ project_id }) => {
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
  });

  registerTool(server, {
    name: 'get_cycle_time_report',
    description: 'Get cycle time metrics (created_at → completed_at) for completed tasks in a project.',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
    },
    returns: z.object({
      average_cycle_time_days: z.number().optional(),
      median_cycle_time_days: z.number().optional(),
      data: z.array(z.object({ task_id: z.string().uuid(), cycle_time_days: z.number() }).passthrough()).optional(),
    }).passthrough(),
    handler: async ({ project_id }) => {
      const result = await api.get(`/projects/${project_id}/reports/cycle-time`);
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting cycle time: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  });

  registerTool(server, {
    name: 'get_time_tracking_report',
    description: 'Get aggregated time entries per user for a project, optionally bounded by a date range.',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
      from: z.string().optional().describe('Start date (ISO 8601).'),
      to: z.string().optional().describe('End date (ISO 8601).'),
    },
    returns: z.object({
      data: z.array(z.object({
        user_id: z.string().uuid(),
        display_name: z.string().optional(),
        total_minutes: z.number(),
      }).passthrough()),
    }),
    handler: async ({ project_id, from, to }) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      const result = await api.get(`/projects/${project_id}/reports/time-tracking${qs ? `?${qs}` : ''}`);
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting time tracking: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  });
}
