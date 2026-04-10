import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { resolveProjectId, resolveTemplateId } from './task-tools.js';

function err(label: string, data: unknown) {
  return {
    content: [{ type: 'text' as const, text: `Error ${label}: ${JSON.stringify(data)}` }],
    isError: true as const,
  };
}

export function registerTemplateTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'list_templates',
    'List available task templates for a project. Accepts project name or UUID.',
    {
      project_id: z.string().describe('Project name or UUID'),
    },
    async ({ project_id }) => {
      const resolvedProjectId = await resolveProjectId(api, project_id);
      if (!resolvedProjectId) {
        return err(
          'listing templates',
          `Project '${project_id}' could not be resolved by name or UUID`,
        );
      }

      const result = await api.get(`/projects/${resolvedProjectId}/task-templates`);

      if (!result.ok) {
        return err('listing templates', result.data);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'create_from_template',
    'Create a task from a template, optionally overriding specific fields. Accepts project name and template name in addition to UUIDs.',
    {
      project_id: z.string().describe('Project name or UUID'),
      template_id: z
        .string()
        .describe('Template name (scoped to the project) or UUID'),
      overrides: z
        .record(z.unknown())
        .optional()
        .describe(
          'Field overrides to apply on top of the template (e.g. { title, assignee_id, priority }). ' +
            'Sub-keys inside overrides must still be UUIDs.',
        ),
    },
    async ({ project_id, template_id, overrides }) => {
      const resolvedProjectId = await resolveProjectId(api, project_id);
      if (!resolvedProjectId) {
        return err(
          'creating from template',
          `Project '${project_id}' could not be resolved by name or UUID`,
        );
      }

      const resolvedTemplateId = await resolveTemplateId(
        api,
        resolvedProjectId,
        template_id,
      );
      if (!resolvedTemplateId) {
        return err(
          'creating from template',
          `Template '${template_id}' could not be resolved in project '${project_id}'`,
        );
      }

      const result = await api.post(
        `/projects/${resolvedProjectId}/task-templates/${resolvedTemplateId}/apply`,
        { overrides: overrides ?? {} },
      );

      if (!result.ok) {
        return err('creating from template', result.data);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
