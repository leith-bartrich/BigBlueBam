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

  // Bam-scoped user resolvers. These duplicate the surface of the
  // top-level `find_user_by_email` / `find_user_by_name` tools from
  // user-resolver-tools.ts so that Bam-centric prompts and rules can
  // find them via the `bam_*` namespace convention. Both tools call the
  // same shared `/users/*` endpoints under the hood.
  server.tool(
    'bam_find_user_by_email',
    "Find a user by their exact email address (case-insensitive, scoped to the caller's active org). Returns the user `{ id, email, name, display_name, avatar_url }` or null when no match.",
    {
      email: z.string().email().describe('Email address to look up'),
    },
    async ({ email }) => {
      const result = await api.get(`/users/by-email?email=${encodeURIComponent(email)}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error looking up user by email: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'bam_find_user',
    "Fuzzy-search users by display name or email (scoped to the caller's active org). Results are ranked by relevance and capped at 20.",
    {
      query: z.string().min(1).describe('Free-text query matched against display name and email'),
    },
    async ({ query }) => {
      const result = await api.get(`/users/search?q=${encodeURIComponent(query)}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error searching users: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
