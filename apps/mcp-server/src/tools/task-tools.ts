import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { handleScopeError } from '../middleware/scope-check.js';

export function registerTaskTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'search_tasks',
    'Search and filter tasks in a project',
    {
      project_id: z.string().uuid().describe('The project ID'),
      q: z.string().optional().describe('Search query string'),
      phase_id: z.string().uuid().optional().describe('Filter by phase'),
      sprint_id: z.string().uuid().optional().describe('Filter by sprint'),
      assignee_id: z.string().uuid().optional().describe('Filter by assignee'),
      priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional().describe('Filter by priority'),
      state_category: z.enum(['todo', 'active', 'blocked', 'review', 'done', 'cancelled']).optional().describe('Filter by state category'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(200).optional().describe('Number of results'),
    },
    async ({ project_id, ...filters }) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) params.set(key, String(value));
      }

      const qs = params.toString();
      const result = await api.get(`/projects/${project_id}/tasks${qs ? `?${qs}` : ''}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error searching tasks: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'get_task',
    'Get detailed information about a specific task',
    {
      task_id: z.string().uuid().describe('The task ID'),
    },
    async ({ task_id }) => {
      const result = await api.get(`/tasks/${task_id}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting task: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'create_task',
    'Create a new task in a project',
    {
      project_id: z.string().uuid().describe('The project ID'),
      title: z.string().max(500).describe('Task title'),
      phase_id: z.string().uuid().describe('Phase to place the task in'),
      description: z.string().optional().describe('Task description (markdown)'),
      sprint_id: z.string().uuid().nullable().optional().describe('Sprint to assign to'),
      assignee_id: z.string().uuid().nullable().optional().describe('User to assign'),
      priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional().describe('Priority level'),
      story_points: z.number().int().positive().nullable().optional().describe('Story point estimate'),
      label_ids: z.array(z.string().uuid()).optional().describe('Label IDs to attach'),
      epic_id: z.string().uuid().nullable().optional().describe('Epic to link to'),
      parent_task_id: z.string().uuid().nullable().optional().describe('Parent task for sub-tasks'),
    },
    async ({ project_id, ...taskData }) => {
      const result = await api.post(`/projects/${project_id}/tasks`, taskData);

      if (!result.ok) {
        const scopeErr = handleScopeError('create_task', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error creating task: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'update_task',
    'Update an existing task',
    {
      task_id: z.string().uuid().describe('The task ID'),
      title: z.string().max(500).optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      assignee_id: z.string().uuid().nullable().optional().describe('New assignee'),
      priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional().describe('New priority'),
      story_points: z.number().int().positive().nullable().optional().describe('New story points'),
      sprint_id: z.string().uuid().nullable().optional().describe('New sprint'),
      state_id: z.string().uuid().optional().describe('New state'),
      start_date: z.string().optional().describe('Start date (ISO 8601)'),
      due_date: z.string().optional().describe('Due date (ISO 8601)'),
    },
    async ({ task_id, ...updates }) => {
      const result = await api.patch(`/tasks/${task_id}`, updates);

      if (!result.ok) {
        const scopeErr = handleScopeError('update_task', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error updating task: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'move_task',
    'Move a task to a different phase and/or position on the board',
    {
      task_id: z.string().uuid().describe('The task ID'),
      phase_id: z.string().uuid().describe('Target phase ID'),
      position: z.number().int().min(0).describe('Position within the phase'),
      sprint_id: z.string().uuid().nullable().optional().describe('Optionally change sprint'),
    },
    async ({ task_id, ...moveData }) => {
      const result = await api.post(`/tasks/${task_id}/move`, moveData);

      if (!result.ok) {
        const scopeErr = handleScopeError('move_task', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error moving task: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'delete_task',
    'Delete a task (destructive action - will ask for confirmation)',
    {
      task_id: z.string().uuid().describe('The task ID to delete'),
      confirm: z.boolean().describe('Must be true to confirm deletion'),
    },
    async ({ task_id, confirm }) => {
      if (!confirm) {
        return {
          content: [{
            type: 'text' as const,
            text: `Are you sure you want to delete task ${task_id}? Call this tool again with confirm: true to proceed.`,
          }],
        };
      }

      const result = await api.delete(`/tasks/${task_id}`);

      if (!result.ok) {
        const scopeErr = handleScopeError('delete_task', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error deleting task: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: `Task ${task_id} deleted successfully.` }],
      };
    },
  );

  server.tool(
    'bulk_update_tasks',
    'Perform a bulk operation on multiple tasks at once',
    {
      task_ids: z.array(z.string().uuid()).min(1).describe('Array of task IDs to update'),
      operation: z.enum(['update', 'move', 'delete', 'assign', 'set_sprint']).describe('The bulk operation to perform'),
      fields: z.record(z.unknown()).optional().describe('Fields to set (depends on operation): e.g. { priority, assignee_id, phase_id, sprint_id }'),
    },
    async ({ task_ids, operation, fields }) => {
      const result = await api.post('/tasks/bulk', { task_ids, operation, fields });

      if (!result.ok) {
        const scopeErr = handleScopeError('bulk_update_tasks', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error in bulk update: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'log_time',
    'Log time spent on a task',
    {
      task_id: z.string().uuid().describe('The task ID'),
      minutes: z.number().int().positive().describe('Number of minutes spent'),
      date: z.string().describe('Date of the time entry (ISO 8601)'),
      description: z.string().optional().describe('Description of work done'),
    },
    async ({ task_id, ...timeData }) => {
      const result = await api.post(`/tasks/${task_id}/time-entries`, timeData);

      if (!result.ok) {
        const scopeErr = handleScopeError('log_time', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error logging time: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'duplicate_task',
    'Duplicate an existing task, optionally including its subtasks',
    {
      task_id: z.string().uuid().describe('The task ID to duplicate'),
      include_subtasks: z.boolean().optional().describe('Whether to also duplicate subtasks (default false)'),
    },
    async ({ task_id, include_subtasks }) => {
      const result = await api.post(`/tasks/${task_id}/duplicate`, { include_subtasks: include_subtasks ?? false });

      if (!result.ok) {
        const scopeErr = handleScopeError('duplicate_task', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error duplicating task: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'import_csv',
    'Import tasks from CSV data into a project',
    {
      project_id: z.string().uuid().describe('The project ID'),
      rows: z.array(z.record(z.string())).describe('Array of row objects from the CSV'),
      mapping: z.record(z.string()).describe('Mapping of CSV column names to task fields (e.g. { "Title": "title", "Priority": "priority" })'),
    },
    async ({ project_id, rows, mapping }) => {
      const result = await api.post(`/projects/${project_id}/import/csv`, { rows, mapping });

      if (!result.ok) {
        const scopeErr = handleScopeError('import_csv', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error importing CSV: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );
}
