import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

export function registerSprintTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'list_sprints',
    'List all sprints for a project',
    {
      project_id: z.string().uuid().describe('The project ID'),
      status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional().describe('Filter by status'),
    },
    async ({ project_id, status }) => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);

      const qs = params.toString();
      const result = await api.get(`/projects/${project_id}/sprints${qs ? `?${qs}` : ''}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing sprints: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'create_sprint',
    'Create a new sprint for a project',
    {
      project_id: z.string().uuid().describe('The project ID'),
      name: z.string().max(100).describe('Sprint name'),
      start_date: z.string().describe('Start date (ISO 8601)'),
      end_date: z.string().describe('End date (ISO 8601)'),
      goal: z.string().optional().describe('Sprint goal'),
    },
    async ({ project_id, ...sprintData }) => {
      const result = await api.post(`/projects/${project_id}/sprints`, sprintData);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error creating sprint: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'start_sprint',
    'Start a planned sprint',
    {
      sprint_id: z.string().uuid().describe('The sprint ID'),
    },
    async ({ sprint_id }) => {
      const result = await api.post(`/sprints/${sprint_id}/start`, {});

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error starting sprint: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'complete_sprint',
    'Complete an active sprint',
    {
      sprint_id: z.string().uuid().describe('The sprint ID'),
      carry_forward: z.object({
        target_sprint_id: z.string().uuid().describe('Sprint to carry incomplete tasks to'),
        tasks: z.array(z.object({
          task_id: z.string().uuid(),
          action: z.enum(['carry_forward', 'backlog', 'cancel']),
        })).describe('Actions for incomplete tasks'),
      }).describe('How to handle incomplete tasks'),
      retrospective_notes: z.string().optional().describe('Retro notes'),
    },
    async ({ sprint_id, ...body }) => {
      const result = await api.post(`/sprints/${sprint_id}/complete`, body);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error completing sprint: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'get_sprint_report',
    'Get a sprint report with velocity, completion stats, and burndown data',
    {
      sprint_id: z.string().uuid().describe('The sprint ID'),
    },
    async ({ sprint_id }) => {
      const result = await api.get(`/sprints/${sprint_id}/report`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting sprint report: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
