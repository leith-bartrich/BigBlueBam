import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { handleScopeError } from '../middleware/scope-check.js';

export function registerProjectTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'list_projects',
    'List all projects the current user has access to',
    {
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(200).optional().describe('Number of results (default 50)'),
    },
    async ({ cursor, limit }) => {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));

      const qs = params.toString();
      const result = await api.get(`/projects${qs ? `?${qs}` : ''}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing projects: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'get_project',
    'Get detailed information about a specific project',
    {
      project_id: z.string().uuid().describe('The project ID'),
    },
    async ({ project_id }) => {
      const result = await api.get(`/projects/${project_id}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting project: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'create_project',
    'Create a new project',
    {
      name: z.string().max(255).describe('Project name'),
      task_id_prefix: z.string().regex(/^[A-Z]{2,6}$/).describe('Task ID prefix (2-6 uppercase letters)'),
      description: z.string().optional().describe('Project description'),
      slug: z.string().max(100).regex(/^[a-z0-9-]+$/).optional().describe('URL-friendly slug'),
      icon: z.string().max(10).optional().describe('Emoji icon'),
      color: z.string().optional().describe('Hex color'),
      template: z.enum(['kanban_standard', 'scrum', 'bug_tracking', 'minimal', 'none']).optional().describe('Project template'),
    },
    async (params) => {
      const result = await api.post('/projects', params);

      if (!result.ok) {
        const scopeErr = handleScopeError('create_project', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error creating project: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
