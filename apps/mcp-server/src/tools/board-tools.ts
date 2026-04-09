import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/**
 * Helper to make requests to the board-api service.
 * Same pattern as bolt-tools.ts — a lightweight fetch wrapper that targets
 * the board-api base URL and forwards the user's auth token.
 */
function createBoardClient(boardApiUrl: string, api: ApiClient) {
  const baseUrl = boardApiUrl.replace(/\/$/, '');

  async function request(method: string, path: string, body?: unknown) {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Forward the bearer token from the main API client
    const token = (api as unknown as { token?: string }).token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }

  return { request };
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(label: string, data: unknown) {
  return {
    content: [{ type: 'text' as const, text: `Error ${label}: ${JSON.stringify(data)}` }],
    isError: true as const,
  };
}

function buildQs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export function registerBoardTools(server: McpServer, api: ApiClient, boardApiUrl: string): void {
  const client = createBoardClient(boardApiUrl, api);

  // ===== BOARD CRUD (5) =====

  server.tool(
    'board_list',
    'List boards with optional filters and pagination.',
    {
      project_id: z.string().uuid().optional().describe('Filter by project'),
      visibility: z.enum(['private', 'project', 'organization']).optional().describe('Filter by visibility'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(100).optional().describe('Page size (default 50, max 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/boards${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing boards', result.data);
    },
  );

  server.tool(
    'board_get',
    'Get board metadata by ID.',
    {
      id: z.string().uuid().describe('Board ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/boards/${id}`);
      return result.ok ? ok(result.data) : err('getting board', result.data);
    },
  );

  server.tool(
    'board_create',
    'Create a new visual collaboration board.',
    {
      name: z.string().max(255).describe('Board name (max 255 chars)'),
      description: z.string().max(2000).optional().describe('Description (max 2000 chars)'),
      project_id: z.string().uuid().optional().describe('Project to associate the board with'),
      template_id: z.string().uuid().optional().describe('Template to initialize the board from'),
      background: z.enum(['dots', 'grid', 'lines', 'plain']).optional().describe('Background pattern (default plain)'),
      visibility: z.enum(['private', 'project', 'organization']).optional().describe('Visibility level (default private)'),
    },
    async (params) => {
      const result = await client.request('POST', '/boards', params);
      return result.ok ? ok(result.data) : err('creating board', result.data);
    },
  );

  server.tool(
    'board_update',
    'Update board metadata. Provide only the fields to change.',
    {
      id: z.string().uuid().describe('Board ID'),
      name: z.string().max(255).optional().describe('Updated name'),
      description: z.string().max(2000).optional().describe('Updated description'),
      background: z.enum(['dots', 'grid', 'lines', 'plain']).optional().describe('Updated background pattern'),
      visibility: z.enum(['private', 'project', 'organization']).optional().describe('Updated visibility'),
      locked: z.boolean().optional().describe('Lock or unlock the board'),
      icon: z.string().max(50).optional().describe('Board icon identifier'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('PATCH', `/boards/${id}`, body);
      return result.ok ? ok(result.data) : err('updating board', result.data);
    },
  );

  server.tool(
    'board_archive',
    'Archive a board (soft delete).',
    {
      id: z.string().uuid().describe('Board ID'),
    },
    async ({ id }) => {
      const result = await client.request('DELETE', `/boards/${id}`);
      return result.ok ? ok(result.data) : err('archiving board', result.data);
    },
  );

  // ===== ELEMENT READING (3) =====

  server.tool(
    'board_read_elements',
    'Read all elements on a board. Returns structured data with positions, text, and types.',
    {
      id: z.string().uuid().describe('Board ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/boards/${id}/elements`);
      return result.ok ? ok(result.data) : err('reading board elements', result.data);
    },
  );

  server.tool(
    'board_read_stickies',
    'Read only sticky note elements from a board.',
    {
      id: z.string().uuid().describe('Board ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/boards/${id}/elements/stickies`);
      return result.ok ? ok(result.data) : err('reading stickies', result.data);
    },
  );

  server.tool(
    'board_read_frames',
    'Read frames with their contained elements from a board.',
    {
      id: z.string().uuid().describe('Board ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/boards/${id}/elements/frames`);
      return result.ok ? ok(result.data) : err('reading frames', result.data);
    },
  );

  // ===== ELEMENT CREATION (2) =====

  server.tool(
    'board_add_sticky',
    'Add a sticky note to a board.',
    {
      board_id: z.string().uuid().describe('Board ID'),
      text: z.string().max(1000).describe('Sticky note text (max 1000 chars)'),
      x: z.number().optional().describe('X position on the canvas'),
      y: z.number().optional().describe('Y position on the canvas'),
      color: z.enum(['yellow', 'green', 'blue', 'red', 'purple', 'orange']).optional().describe('Sticky note color (default yellow)'),
    },
    async ({ board_id, ...body }) => {
      const result = await client.request('POST', `/boards/${board_id}/elements/sticky`, body);
      return result.ok ? ok(result.data) : err('adding sticky', result.data);
    },
  );

  server.tool(
    'board_add_text',
    'Add a text element to a board.',
    {
      board_id: z.string().uuid().describe('Board ID'),
      text: z.string().max(5000).describe('Text content (max 5000 chars)'),
      x: z.number().optional().describe('X position on the canvas'),
      y: z.number().optional().describe('Y position on the canvas'),
    },
    async ({ board_id, ...body }) => {
      const result = await client.request('POST', `/boards/${board_id}/elements/text`, body);
      return result.ok ? ok(result.data) : err('adding text element', result.data);
    },
  );

  // ===== ACTIONS (2) =====

  server.tool(
    'board_promote_to_tasks',
    'Promote sticky notes to Bam tasks in a project.',
    {
      board_id: z.string().uuid().describe('Board ID'),
      element_ids: z.array(z.string().uuid()).min(1).describe('Array of element IDs to promote'),
      project_id: z.string().uuid().describe('Target project ID for the new tasks'),
      phase_id: z.string().uuid().optional().describe('Target phase ID (uses default if omitted)'),
    },
    async ({ board_id, ...body }) => {
      const result = await client.request('POST', `/boards/${board_id}/elements/promote`, body);
      return result.ok ? ok(result.data) : err('promoting elements to tasks', result.data);
    },
  );

  server.tool(
    'board_export',
    'Export a board as SVG or PNG.',
    {
      id: z.string().uuid().describe('Board ID'),
      format: z.enum(['svg', 'png']).describe('Export format'),
    },
    async ({ id, format }) => {
      const result = await client.request('GET', `/boards/${id}/export/${format}`);
      return result.ok ? ok(result.data) : err('exporting board', result.data);
    },
  );

  // ===== DISCOVERY (2) =====

  server.tool(
    'board_summarize',
    'Get a board summary grouped by frames, including element counts and text content.',
    {
      id: z.string().uuid().describe('Board ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/boards/${id}/elements/frames`);
      if (!result.ok) return err('summarizing board', result.data);

      // Return the frames data as a structured summary
      return ok(result.data);
    },
  );

  server.tool(
    'board_search',
    'Search across board element text content.',
    {
      query: z.string().max(500).describe('Search query (max 500 chars)'),
      project_id: z.string().uuid().optional().describe('Filter by project'),
    },
    async (params) => {
      const result = await client.request('GET', `/boards/search${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('searching boards', result.data);
    },
  );
}
