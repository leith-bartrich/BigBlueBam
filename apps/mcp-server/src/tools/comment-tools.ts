import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { handleScopeError } from '../middleware/scope-check.js';
import { resolveTaskId } from './task-tools.js';

export function registerCommentTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'list_comments',
    'List all comments on a task',
    {
      task_id: z.string().uuid().describe('The task ID'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(200).optional().describe('Number of results'),
    },
    async ({ task_id, cursor, limit }) => {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));

      const qs = params.toString();
      const result = await api.get(`/tasks/${task_id}/comments${qs ? `?${qs}` : ''}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing comments: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'add_comment',
    "Add a comment to a task. Accepts either a task UUID or human_id (e.g. 'FRND-42').",
    {
      task_id: z
        .string()
        .describe("Task UUID or human_id (e.g. 'FRND-42')"),
      body: z.string().min(1).describe('Comment body (markdown supported)'),
    },
    async ({ task_id, body }) => {
      const resolvedTaskId = await resolveTaskId(api, task_id);
      if (!resolvedTaskId) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error adding comment: Task '${task_id}' could not be resolved by UUID or human_id`,
            },
          ],
          isError: true,
        };
      }

      const result = await api.post(`/tasks/${resolvedTaskId}/comments`, { body });

      if (!result.ok) {
        const scopeErr = handleScopeError('add_comment', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error adding comment: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
