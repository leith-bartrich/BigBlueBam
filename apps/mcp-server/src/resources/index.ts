import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../middleware/api-client.js';

export function registerResources(server: McpServer, api: ApiClient): void {
  // List all projects
  server.resource(
    'projects',
    'bigbluebam://projects',
    async () => {
      const result = await api.get('/projects');

      return {
        contents: [
          {
            uri: 'bigbluebam://projects',
            mimeType: 'application/json',
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );

  // Board state for a specific project
  server.resource(
    'project_board',
    'bigbluebam://projects/{id}/board',
    async (uri) => {
      // Extract project ID from the URI
      const match = uri.href.match(/bigbluebam:\/\/projects\/([^/]+)\/board/);
      const projectId = match?.[1] ?? '';

      const result = await api.get(`/projects/${projectId}/board`);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );

  // Task detail by human-readable ID (e.g., BBB-42)
  server.resource(
    'task_by_human_id',
    'bigbluebam://tasks/{human_id}',
    async (uri) => {
      const match = uri.href.match(/bigbluebam:\/\/tasks\/([^/]+)/);
      const humanId = match?.[1] ?? '';

      // The API should support lookup by human ID
      const result = await api.get(`/tasks/by-human-id/${humanId}`);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );

  // Current user's assigned tasks
  server.resource(
    'my_tasks',
    'bigbluebam://me/tasks',
    async () => {
      const result = await api.get('/me/tasks');

      return {
        contents: [
          {
            uri: 'bigbluebam://me/tasks',
            mimeType: 'application/json',
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );

  // Project backlog (tasks not assigned to any sprint)
  server.resource(
    'project_backlog',
    'bigbluebam://projects/{id}/backlog',
    async (uri) => {
      const match = uri.href.match(/bigbluebam:\/\/projects\/([^/]+)\/backlog/);
      const projectId = match?.[1] ?? '';

      const result = await api.get(`/projects/${projectId}/tasks?sprint_id=null`);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );

  // Sprint details
  server.resource(
    'sprint_detail',
    'bigbluebam://sprints/{id}',
    async (uri) => {
      const match = uri.href.match(/bigbluebam:\/\/sprints\/([^/]+)/);
      const sprintId = match?.[1] ?? '';

      const result = await api.get(`/sprints/${sprintId}`);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );

  // Current user's notifications
  server.resource(
    'my_notifications',
    'bigbluebam://me/notifications',
    async () => {
      const result = await api.get('/me/notifications');

      return {
        contents: [
          {
            uri: 'bigbluebam://me/notifications',
            mimeType: 'application/json',
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );
}

/** Helper to make requests to the banter-api service for resources */
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

export function registerBanterResources(server: McpServer, banterApiUrl: string): void {
  // List all Banter channels
  server.resource(
    'banter_channels',
    'banter://channels',
    async () => {
      const data = await banterFetch(banterApiUrl, '/banter/api/v1/channels');

      return {
        contents: [
          {
            uri: 'banter://channels',
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // Channel detail with recent messages
  server.resource(
    'banter_channel_detail',
    'banter://channels/{slug}',
    async (uri) => {
      const match = uri.href.match(/banter:\/\/channels\/([^/]+)/);
      const slug = match?.[1] ?? '';

      // Fetch channel by slug, which returns detail including recent messages
      const data = await banterFetch(banterApiUrl, `/banter/api/v1/channels/by-slug/${slug}`);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // DM detail
  server.resource(
    'banter_dm',
    'banter://dm/{userId}',
    async (uri) => {
      const match = uri.href.match(/banter:\/\/dm\/([^/]+)/);
      const userId = match?.[1] ?? '';

      const data = await banterFetch(banterApiUrl, `/banter/api/v1/dm/${userId}`);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // Current user's unread summary
  server.resource(
    'banter_unread',
    'banter://me/unread',
    async () => {
      const data = await banterFetch(banterApiUrl, '/banter/api/v1/me/unread');

      return {
        contents: [
          {
            uri: 'banter://me/unread',
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // Search results
  server.resource(
    'banter_search',
    'banter://search?q={query}',
    async (uri) => {
      const match = uri.href.match(/banter:\/\/search\?q=([^&]*)/);
      const query = decodeURIComponent(match?.[1] ?? '');

      const data = await banterFetch(
        banterApiUrl,
        `/banter/api/v1/search/messages?q=${encodeURIComponent(query)}`,
      );

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );
}
