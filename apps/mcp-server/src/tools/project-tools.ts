import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { handleScopeError } from '../middleware/scope-check.js';
import { registerTool } from '../lib/register-tool.js';

const projectShape = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().optional(),
  task_id_prefix: z.string(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

export function registerProjectTools(server: McpServer, api: ApiClient): void {
  registerTool(server, {
    name: 'list_projects',
    description: 'List all projects the current user has access to',
    input: {
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(200).optional().describe('Number of results (default 50)'),
    },
    returns: z.object({ data: z.array(projectShape), next_cursor: z.string().nullable().optional() }),
    handler: async ({ cursor, limit }) => {
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
  });

  registerTool(server, {
    name: 'get_project',
    description: 'Get detailed information about a specific project',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
    },
    returns: projectShape,
    handler: async ({ project_id }) => {
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
  });

  registerTool(server, {
    name: 'create_project',
    description: 'Create a new project',
    input: {
      name: z.string().max(255).describe('Project name'),
      task_id_prefix: z.string().regex(/^[A-Z]{2,6}$/).describe('Task ID prefix (2-6 uppercase letters)'),
      description: z.string().optional().describe('Project description'),
      slug: z.string().max(100).regex(/^[a-z0-9-]+$/).optional().describe('URL-friendly slug'),
      icon: z.string().max(10).optional().describe('Emoji icon'),
      color: z.string().optional().describe('Hex color'),
      template: z.enum(['kanban_standard', 'scrum', 'bug_tracking', 'minimal', 'none']).optional().describe('Project template'),
    },
    returns: projectShape,
    handler: async (params) => {
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
  });

  registerTool(server, {
    name: 'test_slack_webhook',
    description: 'Send a test message to the Slack webhook configured for a project. Requires project admin or org admin role.',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
    },
    returns: z.object({ ok: z.boolean(), message: z.string().optional() }),
    handler: async ({ project_id }) => {
      const result = await api.post(`/projects/${project_id}/slack-integration/test`, {});

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error testing Slack webhook: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  });

  registerTool(server, {
    name: 'disconnect_github_integration',
    description: 'Remove the GitHub integration from a project. This is destructive — it deletes the webhook config and all linked commit/PR references. Requires project admin or org admin role.',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
      confirm: z.boolean().describe('Must be true to proceed with the destructive action.'),
    },
    returns: z.object({ ok: z.boolean() }),
    handler: async ({ project_id, confirm }) => {
      if (!confirm) {
        return {
          content: [{ type: 'text' as const, text: 'Set confirm=true to proceed with this destructive action.' }],
          isError: true,
        };
      }

      const result = await api.delete(`/projects/${project_id}/github-integration`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error disconnecting GitHub integration: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  });
}
