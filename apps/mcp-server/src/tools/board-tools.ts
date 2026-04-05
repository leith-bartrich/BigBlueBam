import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { handleScopeError } from '../middleware/scope-check.js';

export function registerBoardTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'get_board',
    'Get the full board state for a project, including all phases and their tasks',
    {
      project_id: z.string().uuid().describe('The project ID'),
      sprint_id: z.string().uuid().optional().describe('Filter by sprint (optional)'),
    },
    async ({ project_id, sprint_id }) => {
      const params = new URLSearchParams();
      if (sprint_id) params.set('sprint_id', sprint_id);

      const qs = params.toString();
      const result = await api.get(`/projects/${project_id}/board${qs ? `?${qs}` : ''}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting board: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'list_phases',
    'List all phases (columns) for a project',
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
    'create_phase',
    'Create a new phase (column) in a project board',
    {
      project_id: z.string().uuid().describe('The project ID'),
      name: z.string().max(100).describe('Phase name'),
      position: z.number().int().min(0).describe('Position on the board (0-based)'),
      wip_limit: z.number().int().positive().optional().describe('Work-in-progress limit'),
      is_terminal: z.boolean().optional().describe('Whether this is a terminal/done phase'),
    },
    async ({ project_id, ...phaseData }) => {
      const result = await api.post(`/projects/${project_id}/phases`, phaseData);

      if (!result.ok) {
        const scopeErr = handleScopeError('create_phase', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error creating phase: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'reorder_phases',
    'Reorder the phases (columns) on a project board',
    {
      project_id: z.string().uuid().describe('The project ID'),
      phase_ids: z.array(z.string().uuid()).describe('Ordered array of phase IDs representing the new order'),
    },
    async ({ project_id, phase_ids }) => {
      const result = await api.post(`/projects/${project_id}/phases/reorder`, { phase_ids });

      if (!result.ok) {
        const scopeErr = handleScopeError('reorder_phases', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error reordering phases: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
