import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { resolveProjectId, resolveTemplateId } from './task-tools.js';
import { registerTool } from '../lib/register-tool.js';

const templateShape = z.object({
  id: z.string().uuid(),
  name: z.string(),
  project_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

function err(label: string, data: unknown) {
  return {
    content: [{ type: 'text' as const, text: `Error ${label}: ${JSON.stringify(data)}` }],
    isError: true as const,
  };
}

export function registerTemplateTools(server: McpServer, api: ApiClient): void {
  registerTool(server, {
    name: 'list_templates',
    description: 'List available task templates for a project. Accepts project name or UUID.',
    input: {
      project_id: z.string().describe('Project name or UUID'),
    },
    returns: z.object({ data: z.array(templateShape) }),
    handler: async ({ project_id }) => {
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
  });

  registerTool(server, {
    name: 'create_from_template',
    description: 'Create a task from a template, optionally overriding specific fields. Accepts project name and template name in addition to UUIDs.',
    input: {
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
    returns: z.object({
      id: z.string().uuid(),
      human_id: z.string(),
      title: z.string(),
      project_id: z.string().uuid(),
    }).passthrough(),
    handler: async ({ project_id, template_id, overrides }) => {
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
  });
}
