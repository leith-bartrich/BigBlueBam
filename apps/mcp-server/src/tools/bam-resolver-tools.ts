import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/**
 * Bam resolver / list tools — Phase C, Tier 2 of the Bolt ID-mapping
 * strategy. These are read-only lookups that let MCP consumers translate
 * human-friendly references (phase name, label name, state category,
 * epic name, etc.) into the canonical UUIDs the mutating Bam tools
 * already require. All tools call the Bam REST API rather than the DB
 * directly, and all handlers match the standard MCP response envelope
 * used by the other tool files in this directory.
 */
export function registerBamResolverTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'bam_list_phases',
    "List all phases (board columns) for a project, ordered by position",
    {
      project_id: z.string().uuid().describe('The project ID'),
    },
    async ({ project_id }) => {
      const result = await api.get(`/projects/${project_id}/phases`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing phases: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'bam_list_labels',
    'List labels. If project_id is given, lists labels for that project; otherwise lists labels for every project the caller can see in their org.',
    {
      project_id: z.string().uuid().optional().describe('Optional project ID to scope results'),
    },
    async ({ project_id }) => {
      const path = project_id ? `/projects/${project_id}/labels` : '/labels';
      const result = await api.get(path);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing labels: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'bam_list_states',
    "List all task states for a project, ordered by position. Each state has a category in { todo, active, blocked, review, done, cancelled }.",
    {
      project_id: z.string().uuid().describe('The project ID'),
    },
    async ({ project_id }) => {
      const result = await api.get(`/projects/${project_id}/states`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing states: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'bam_list_epics',
    'List all epics for a project, with task counts and status.',
    {
      project_id: z.string().uuid().describe('The project ID'),
    },
    async ({ project_id }) => {
      const result = await api.get(`/projects/${project_id}/epics`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing epics: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
