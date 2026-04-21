import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/** Helper to make requests to the banter-api for prompts */
async function banterFetch(banterApiUrl: string, path: string) {
  const url = `${banterApiUrl.replace(/\/$/, '')}${path}`;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  } catch {
    return { error: 'Failed to reach banter-api' };
  }
}

export function registerPrompts(server: McpServer, api: ApiClient, banterApiUrl?: string): void {
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

  // ---------------------------------------------------------------------------
  // Banter prompts
  // ---------------------------------------------------------------------------

  const banterUrl = banterApiUrl ?? 'http://localhost:4002';

  server.prompt(
    'banter_channel_summary',
    'Fetch recent messages from a Banter channel and generate a summary',
    {
      channel_id: z.string().uuid().describe('The channel ID to summarize'),
      limit: z.string().optional().describe('Number of recent messages to include (default 50)'),
    },
    async ({ channel_id, limit }) => {
      const msgLimit = limit ?? '50';
      const messagesData = await banterFetch(
        banterUrl,
        `/v1/channels/${channel_id}/messages?limit=${msgLimit}`,
      );
      const channelData = await banterFetch(banterUrl, `/v1/channels/${channel_id}`);

      const messages = JSON.stringify(messagesData, null, 2);
      const channel = JSON.stringify(channelData, null, 2);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are a Banter channel summary assistant.

## Channel Info
${channel}

## Recent Messages
${messages}

Please provide a concise summary of the recent conversation in this channel:

1. **Key topics discussed**: What were the main subjects people talked about?
2. **Decisions made**: Were any decisions or conclusions reached?
3. **Action items**: Were any tasks or follow-ups mentioned?
4. **Open questions**: Are there any unresolved questions?
5. **Participants**: Who were the most active contributors?

Format the summary so someone who missed the conversation can quickly get up to speed.`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'banter_standup_broadcast',
    'Generate a standup summary from BigBlueBam project data and format it for posting to Banter',
    {
      project_id: z.string().uuid().describe('The Bam project ID to pull standup data from'),
      channel_id: z.string().uuid().describe('The Banter channel ID where the standup will be posted'),
    },
    async ({ project_id, channel_id }) => {
      // Fetch project board state from Bam
      const boardResult = await api.get(`/projects/${project_id}/board`);
      const sprintResult = await api.get(`/projects/${project_id}/sprints?status=active&limit=1`);

      // Fetch channel info from Banter
      const channelData = await banterFetch(banterUrl, `/v1/channels/${channel_id}`);

      const board = JSON.stringify(boardResult.data, null, 2);
      const sprint = JSON.stringify(
        (sprintResult.data as Record<string, unknown>)?.data ?? sprintResult.data,
        null,
        2,
      );
      const channel = JSON.stringify(channelData, null, 2);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are a standup broadcast assistant. Generate a standup update to post in a Banter channel.

## Active Sprint
${sprint}

## Current Board State
${board}

## Target Channel
${channel}

Generate a formatted standup message suitable for posting in the Banter channel. The message should:

1. Start with a greeting and the date
2. List what was completed since the last standup
3. List what is in progress with assignees
4. Flag any blocked items
5. Show sprint progress (story points completed vs total)
6. End with any reminders or upcoming deadlines

Format the output as a single Banter message using markdown. Keep it concise but informative.`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'banter_thread_summary',
    'Summarize a long Banter thread conversation',
    {
      message_id: z.string().uuid().describe('The parent message ID of the thread'),
    },
    async ({ message_id }) => {
      const threadData = await banterFetch(
        banterUrl,
        `/v1/messages/${message_id}/thread?limit=100`,
      );
      const parentData = await banterFetch(
        banterUrl,
        `/v1/messages/${message_id}`,
      );

      const thread = JSON.stringify(threadData, null, 2);
      const parent = JSON.stringify(parentData, null, 2);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are a Banter thread summary assistant.

## Original Message
${parent}

## Thread Replies
${thread}

Please provide a concise summary of this thread:

1. **Original topic**: What was the thread about?
2. **Key points**: What were the main arguments or points made?
3. **Outcome**: Was a conclusion or decision reached?
4. **Action items**: Were any follow-ups or tasks identified?
5. **Dissenting views**: Were there any disagreements or alternative perspectives?

Keep the summary brief enough to post as a reply in the thread itself.`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'banter_call_recap',
    'Summarize a Banter call transcript',
    {
      call_id: z.string().uuid().describe('The call ID to summarize'),
    },
    async ({ call_id }) => {
      const callData = await banterFetch(banterUrl, `/v1/calls/${call_id}`);
      const transcriptData = await banterFetch(
        banterUrl,
        `/v1/calls/${call_id}/transcript`,
      );

      const call = JSON.stringify(callData, null, 2);
      const transcript = JSON.stringify(transcriptData, null, 2);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are a Banter call recap assistant.

## Call Details
${call}

## Transcript
${transcript}

Please provide a structured call recap:

1. **Participants**: Who was on the call?
2. **Duration**: How long was the call?
3. **Topics discussed**: What subjects were covered?
4. **Decisions made**: What was agreed upon?
5. **Action items**: What tasks or follow-ups were assigned and to whom?
6. **Key quotes**: Any particularly important statements (with attribution)?
7. **Next steps**: What happens next?

Format this as a call recap that can be posted to the channel for anyone who missed the call.`,
            },
          },
        ],
      };
    },
  );
}
