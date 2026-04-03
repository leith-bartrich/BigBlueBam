import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

export function registerMemberTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'list_members',
    'List members of a project or the entire organization',
    {
      project_id: z.string().uuid().optional().describe('Project ID to list members for. If omitted, lists org-level members.'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(200).optional().describe('Number of results'),
    },
    async ({ project_id, cursor, limit }) => {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));

      const qs = params.toString();
      const path = project_id
        ? `/projects/${project_id}/members${qs ? `?${qs}` : ''}`
        : `/org/members${qs ? `?${qs}` : ''}`;

      const result = await api.get(path);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing members: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'get_my_tasks',
    'Get tasks assigned to the current authenticated user, optionally filtered by project',
    {
      project_id: z.string().uuid().optional().describe('Filter by project ID'),
      state_category: z.enum(['todo', 'active', 'blocked', 'review', 'done', 'cancelled']).optional().describe('Filter by state category'),
      sprint_id: z.string().uuid().optional().describe('Filter by sprint'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(200).optional().describe('Number of results'),
    },
    async ({ project_id, state_category, sprint_id, cursor, limit }) => {
      // First get the current user's info to find their ID
      const meResult = await api.get<{ id: string }>('/auth/me');

      if (!meResult.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching current user: ${JSON.stringify(meResult.data)}` }],
          isError: true,
        };
      }

      const userId = meResult.data.id;

      const params = new URLSearchParams();
      params.set('assignee_id', userId);
      if (state_category) params.set('state_category', state_category);
      if (sprint_id) params.set('sprint_id', sprint_id);
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));

      const qs = params.toString();

      if (project_id) {
        const result = await api.get(`/projects/${project_id}/tasks?${qs}`);

        if (!result.ok) {
          return {
            content: [{ type: 'text' as const, text: `Error fetching tasks: ${JSON.stringify(result.data)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
        };
      }

      // Without a project_id, use the /me/tasks endpoint
      const result = await api.get(`/me/tasks?${qs}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching my tasks: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
