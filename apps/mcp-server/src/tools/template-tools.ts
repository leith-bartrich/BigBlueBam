import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

export function registerTemplateTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'list_templates',
    'List available task templates for a project',
    {
      project_id: z.string().uuid().describe('The project ID'),
    },
    async ({ project_id }) => {
      const result = await api.get(`/projects/${project_id}/task-templates`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing templates: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'create_from_template',
    'Create a task from a template, optionally overriding specific fields',
    {
      project_id: z.string().uuid().describe('The project ID'),
      template_id: z.string().uuid().describe('The template ID to apply'),
      overrides: z.record(z.unknown()).optional().describe('Field overrides to apply on top of the template (e.g. { title, assignee_id, priority })'),
    },
    async ({ project_id, template_id, overrides }) => {
      const result = await api.post(`/projects/${project_id}/task-templates/${template_id}/apply`, { overrides: overrides ?? {} });

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error creating from template: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
