import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

export function registerPrompts(server: McpServer, api: ApiClient): void {
  server.prompt(
    'sprint_planning',
    'Generate a structured sprint planning prompt with backlog and velocity data',
    { project_id: z.string().uuid().describe('The project ID to plan a sprint for') },
    async ({ project_id }) => {
      // Fetch backlog tasks (tasks not in any active sprint with state category "todo")
      const backlogResult = await api.get(
        `/projects/${project_id}/tasks?state_category=todo&sprint_id=null&limit=100`,
      );

      // Fetch recent completed sprints for velocity
      const sprintsResult = await api.get(
        `/projects/${project_id}/sprints?status=completed&limit=5`,
      );

      const backlog = JSON.stringify(
        (backlogResult.data as Record<string, unknown>)?.data ?? backlogResult.data,
        null,
        2,
      );
      const sprints = JSON.stringify(
        (sprintsResult.data as Record<string, unknown>)?.data ?? sprintsResult.data,
        null,
        2,
      );

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are a sprint planning assistant for a BigBlueBam project.

## Recent Sprint Velocity
${sprints}

## Current Backlog
${backlog}

Based on the team's recent velocity and the current backlog, help plan the next sprint:

1. Calculate the average velocity from the last completed sprints
2. Recommend which backlog items to include in the next sprint based on priority and story points
3. Flag any items that seem too large and should be broken down
4. Suggest a sprint goal based on the selected items
5. Identify any risks or dependencies between selected items

Please provide a structured sprint plan with recommended items, total story points, and sprint goal.`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'daily_standup',
    'Generate a daily standup summary for a project',
    { project_id: z.string().uuid().describe('The project ID') },
    async ({ project_id }) => {
      // Fetch current board state
      const boardResult = await api.get(`/projects/${project_id}/board`);

      // Fetch active sprint
      const sprintResult = await api.get(
        `/projects/${project_id}/sprints?status=active&limit=1`,
      );

      const board = JSON.stringify(boardResult.data, null, 2);
      const sprint = JSON.stringify(
        (sprintResult.data as Record<string, unknown>)?.data ?? sprintResult.data,
        null,
        2,
      );

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are a standup facilitator for a BigBlueBam project.

## Active Sprint
${sprint}

## Current Board State
${board}

Please provide a standup summary:

1. **What's in progress**: List tasks currently in active/review phases with assignees
2. **What's blocked**: Identify any tasks in blocked states
3. **Sprint progress**: Calculate percentage of sprint work completed (by story points)
4. **Sprint burndown status**: Are we on track to complete the sprint by the end date?
5. **Attention needed**: Flag any tasks that have been in the same phase for an unusually long time

Format the summary as a concise standup report.`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'sprint_retrospective',
    'Generate a sprint retrospective analysis',
    { sprint_id: z.string().uuid().describe('The sprint ID to review') },
    async ({ sprint_id }) => {
      const reportResult = await api.get(`/sprints/${sprint_id}/report`);

      const report = JSON.stringify(reportResult.data, null, 2);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are a retrospective facilitator for a BigBlueBam sprint.

## Sprint Report
${report}

Please facilitate a sprint retrospective by analyzing:

1. **What went well**: Based on completion rates, velocity, and on-time delivery
2. **What could be improved**: Based on carried-over items, blocked tasks, and scope changes
3. **Velocity analysis**: Compare this sprint's velocity to the team average
4. **Story point accuracy**: Were estimates accurate? Identify over/under-estimated items
5. **Suggested action items**: 3-5 concrete improvements for the next sprint

Provide the retrospective in a structured format that the team can discuss.`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'task_breakdown',
    'Help break down a large task into smaller sub-tasks',
    { task_id: z.string().uuid().describe('The task ID to break down') },
    async ({ task_id }) => {
      const taskResult = await api.get(`/tasks/${task_id}`);

      const task = JSON.stringify(taskResult.data, null, 2);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are a task breakdown assistant for BigBlueBam.

## Task to Break Down
${task}

Please help break this task into smaller, actionable sub-tasks:

1. Analyze the task title and description to understand the full scope
2. Identify distinct pieces of work that can be completed independently
3. For each sub-task, provide:
   - A clear, concise title
   - A brief description of what needs to be done
   - An estimated story point value (1, 2, 3, 5, or 8)
   - Any dependencies on other sub-tasks
4. Ensure sub-tasks are small enough to complete in 1-2 days
5. Include any testing or documentation sub-tasks if appropriate

Format the breakdown as a numbered list with details for each sub-task.`,
            },
          },
        ],
      };
    },
  );
}
