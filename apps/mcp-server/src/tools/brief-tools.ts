import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/**
 * Helper to make requests to the brief-api service.
 * Same pattern as beacon-tools.ts — a lightweight fetch wrapper that targets
 * the brief-api base URL and forwards the user's auth token.
 */
function createBriefClient(briefApiUrl: string, api: ApiClient) {
  const baseUrl = briefApiUrl.replace(/\/$/, '');

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

export function registerBriefTools(server: McpServer, api: ApiClient, briefApiUrl: string): void {
  const client = createBriefClient(briefApiUrl, api);

  // ===== DOCUMENTS CRUD (9) =====

  server.tool(
    'brief_list',
    'List Brief documents with optional filters and pagination.',
    {
      project_id: z.string().uuid().optional().describe('Filter by project'),
      folder_id: z.string().uuid().optional().describe('Filter by folder'),
      status: z.enum(['draft', 'in_review', 'approved', 'archived']).optional().describe('Filter by document status'),
      created_by: z.string().uuid().optional().describe('Filter by author user ID'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(100).optional().describe('Page size (default 50, max 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/documents${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing documents', result.data);
    },
  );

  server.tool(
    'brief_get',
    'Retrieve a single Brief document by ID or slug.',
    {
      id: z.string().describe('Document ID (UUID) or slug'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/documents/${id}`);
      return result.ok ? ok(result.data) : err('getting document', result.data);
    },
  );

  server.tool(
    'brief_create',
    'Create a new Brief document.',
    {
      title: z.string().max(500).optional().describe('Document title (max 500 chars)'),
      project_id: z.string().uuid().optional().describe('Project to create the document in'),
      folder_id: z.string().uuid().optional().describe('Folder to place the document in'),
      template_id: z.string().uuid().optional().describe('Template to base the document on'),
      content: z.string().max(500_000).optional().describe('Initial Markdown content (max 500k chars)'),
      visibility: z.enum(['private', 'project', 'organization']).optional().describe('Document visibility level'),
    },
    async (params) => {
      const result = await client.request('POST', '/documents', params);
      return result.ok ? ok(result.data) : err('creating document', result.data);
    },
  );

  server.tool(
    'brief_update',
    'Update Brief document metadata. Provide only the fields to change.',
    {
      id: z.string().uuid().describe('Document ID'),
      title: z.string().max(500).optional().describe('Updated title'),
      status: z.enum(['draft', 'in_review', 'approved', 'archived']).optional().describe('Updated status'),
      visibility: z.enum(['private', 'project', 'organization']).optional().describe('Updated visibility'),
      folder_id: z.string().uuid().optional().describe('Move to a different folder'),
      icon: z.string().max(100).optional().describe('Document icon (emoji or icon name)'),
      pinned: z.boolean().optional().describe('Pin document to top of list'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('PATCH', `/documents/${id}`, body);
      return result.ok ? ok(result.data) : err('updating document', result.data);
    },
  );

  server.tool(
    'brief_update_content',
    'Replace the entire content of a Brief document with new Markdown.',
    {
      id: z.string().uuid().describe('Document ID'),
      content: z.string().max(500_000).describe('New Markdown content (max 500k chars)'),
    },
    async ({ id, content }) => {
      const result = await client.request('PUT', `/documents/${id}/content`, { content });
      return result.ok ? ok(result.data) : err('updating document content', result.data);
    },
  );

  server.tool(
    'brief_append_content',
    'Append Markdown content to the end of a Brief document.',
    {
      id: z.string().uuid().describe('Document ID'),
      content: z.string().max(100_000).describe('Markdown to append (max 100k chars)'),
    },
    async ({ id, content }) => {
      const result = await client.request('POST', `/documents/${id}/append`, { content });
      return result.ok ? ok(result.data) : err('appending to document', result.data);
    },
  );

  server.tool(
    'brief_archive',
    'Archive a Brief document (soft-delete).',
    {
      id: z.string().uuid().describe('Document ID'),
    },
    async ({ id }) => {
      const result = await client.request('DELETE', `/documents/${id}`);
      return result.ok ? ok(result.data) : err('archiving document', result.data);
    },
  );

  server.tool(
    'brief_restore',
    'Restore an archived Brief document.',
    {
      id: z.string().uuid().describe('Document ID'),
    },
    async ({ id }) => {
      const result = await client.request('POST', `/documents/${id}/restore`);
      return result.ok ? ok(result.data) : err('restoring document', result.data);
    },
  );

  server.tool(
    'brief_duplicate',
    'Duplicate a Brief document, optionally into a different project.',
    {
      id: z.string().uuid().describe('Document ID to duplicate'),
      project_id: z.string().uuid().optional().describe('Target project ID (defaults to same project)'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('POST', `/documents/${id}/duplicate`, Object.keys(body).length ? body : undefined);
      return result.ok ? ok(result.data) : err('duplicating document', result.data);
    },
  );

  // ===== SEARCH (1) =====

  server.tool(
    'brief_search',
    'Search Brief documents by keyword or semantic similarity.',
    {
      query: z.string().max(500).describe('Search query text (max 500 chars)'),
      project_id: z.string().uuid().optional().describe('Filter by project'),
      status: z.enum(['draft', 'in_review', 'approved', 'archived']).optional().describe('Filter by status'),
      semantic: z.boolean().optional().describe('Enable semantic (vector) search (default false)'),
      limit: z.number().int().positive().max(100).optional().describe('Max results (default 50, max 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/documents/search${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('searching documents', result.data);
    },
  );

  // ===== COMMENTS (3) =====

  server.tool(
    'brief_comment_list',
    'List comments on a Brief document.',
    {
      document_id: z.string().uuid().describe('Document ID'),
    },
    async ({ document_id }) => {
      const result = await client.request('GET', `/documents/${document_id}/comments`);
      return result.ok ? ok(result.data) : err('listing comments', result.data);
    },
  );

  server.tool(
    'brief_comment_add',
    'Add a comment to a Brief document, optionally as a reply or anchored to specific text.',
    {
      document_id: z.string().uuid().describe('Document ID'),
      body: z.string().max(10_000).describe('Comment body text (max 10k chars)'),
      parent_id: z.string().uuid().optional().describe('Parent comment ID for threaded reply'),
      anchor_text: z.string().max(500).optional().describe('Text selection the comment is anchored to (max 500 chars)'),
    },
    async ({ document_id, ...body }) => {
      const result = await client.request('POST', `/documents/${document_id}/comments`, body);
      return result.ok ? ok(result.data) : err('adding comment', result.data);
    },
  );

  server.tool(
    'brief_comment_resolve',
    'Toggle the resolved state of a comment.',
    {
      comment_id: z.string().uuid().describe('Comment ID'),
    },
    async ({ comment_id }) => {
      const result = await client.request('POST', `/comments/${comment_id}/resolve`);
      return result.ok ? ok(result.data) : err('resolving comment', result.data);
    },
  );

  // ===== VERSIONS (3) =====

  server.tool(
    'brief_versions',
    'List the version history of a Brief document.',
    {
      document_id: z.string().uuid().describe('Document ID'),
    },
    async ({ document_id }) => {
      const result = await client.request('GET', `/documents/${document_id}/versions`);
      return result.ok ? ok(result.data) : err('listing versions', result.data);
    },
  );

  server.tool(
    'brief_version_get',
    'Get a specific version of a Brief document.',
    {
      document_id: z.string().uuid().describe('Document ID'),
      version_id: z.string().uuid().describe('Version ID'),
    },
    async ({ document_id, version_id }) => {
      const result = await client.request('GET', `/documents/${document_id}/versions/${version_id}`);
      return result.ok ? ok(result.data) : err('getting version', result.data);
    },
  );

  server.tool(
    'brief_version_restore',
    'Restore a Brief document to a specific previous version.',
    {
      document_id: z.string().uuid().describe('Document ID'),
      version_id: z.string().uuid().describe('Version ID to restore'),
    },
    async ({ document_id, version_id }) => {
      const result = await client.request('POST', `/documents/${document_id}/versions/${version_id}/restore`);
      return result.ok ? ok(result.data) : err('restoring version', result.data);
    },
  );

  // ===== INTEGRATIONS (2) =====

  server.tool(
    'brief_promote_to_beacon',
    'Graduate a Brief document to a Beacon knowledge article.',
    {
      id: z.string().uuid().describe('Document ID to promote'),
    },
    async ({ id }) => {
      const result = await client.request('POST', `/documents/${id}/promote`);
      return result.ok ? ok(result.data) : err('promoting document to beacon', result.data);
    },
  );

  server.tool(
    'brief_link_task',
    'Link a Brief document to a Bam task.',
    {
      document_id: z.string().uuid().describe('Document ID'),
      task_id: z.string().uuid().describe('Bam task ID to link'),
      link_type: z.enum(['reference', 'spec', 'notes', 'postmortem']).optional().describe('Type of link (default reference)'),
    },
    async ({ document_id, ...body }) => {
      const result = await client.request('POST', `/documents/${document_id}/links/task`, body);
      return result.ok ? ok(result.data) : err('linking document to task', result.data);
    },
  );
}
