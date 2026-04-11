import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { registerTool } from '../lib/register-tool.js';

export function registerImportTools(server: McpServer, api: ApiClient): void {
  registerTool(server, {
    name: 'import_github_issues',
    description: 'Import GitHub issues into a project as tasks',
    input: {
      project_id: z.string().uuid().describe('The project ID'),
      issues: z.array(z.object({
        number: z.number().int().describe('GitHub issue number'),
        title: z.string().describe('Issue title'),
        body: z.string().nullable().optional().describe('Issue body/description'),
        state: z.string().optional().describe('Issue state (open/closed)'),
        labels: z.array(z.string()).optional().describe('Label names'),
        assignee: z.string().nullable().optional().describe('Assignee login'),
      })).describe('Array of GitHub issues to import'),
    },
    returns: z.object({ imported: z.number(), failed: z.number().optional(), errors: z.array(z.string()).optional() }),
    handler: async ({ project_id, issues }) => {
      const result = await api.post(`/projects/${project_id}/import/github`, { issues });

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error importing GitHub issues: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  });

  registerTool(server, {
    name: 'suggest_branch_name',
    description: 'Generate a git branch name suggestion based on a task. Fetches the task and returns a name like "feature/FRND-42-design-login-screen".',
    input: {
      task_id: z.string().uuid().describe('The task ID to generate a branch name for'),
    },
    returns: z.object({ branch_name: z.string(), task_id: z.string().uuid(), human_id: z.string(), title: z.string() }),
    handler: async ({ task_id }) => {
      const result = await api.get<{ human_id: string; title: string }>(`/tasks/${task_id}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching task: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      const { human_id, title } = result.data;

      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);

      const branchName = `feature/${human_id}-${slug}`;

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ branch_name: branchName, task_id, human_id, title }, null, 2) }],
      };
    },
  });
}
