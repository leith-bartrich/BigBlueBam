import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/**
 * Helper to make requests to the beacon-api service.
 * Same pattern as helpdesk-tools.ts / banter-tools.ts — a lightweight fetch
 * wrapper that targets the beacon-api base URL and forwards the user's auth token.
 */
function createBeaconClient(beaconApiUrl: string, api: ApiClient) {
  const baseUrl = beaconApiUrl.replace(/\/$/, '');

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

export function registerBeaconTools(server: McpServer, api: ApiClient, beaconApiUrl: string): void {
  const client = createBeaconClient(beaconApiUrl, api);

  // ===== CRUD (11) =====

  server.tool(
    'beacon_create',
    'Create a new Beacon (Draft). Provide title, body, tags, visibility, and optional project/org scope.',
    {
      title: z.string().min(1).max(500).describe('Beacon title'),
      summary: z.string().max(1000).optional().describe('Short summary (plain text)'),
      body: z.string().describe('Beacon body content (Markdown or rich text)'),
      tags: z.array(z.string()).optional().describe('Tags to attach'),
      visibility: z.enum(['Public', 'Organization', 'Project', 'Private']).optional().describe('Visibility level'),
      project_id: z.string().uuid().optional().describe('Project scope (if project-level)'),
      owner_id: z.string().uuid().optional().describe('Owner user ID (defaults to caller)'),
    },
    async (params) => {
      const result = await client.request('POST', '/beacons', params);
      return result.ok ? ok(result.data) : err('creating beacon', result.data);
    },
  );

  server.tool(
    'beacon_list',
    'List Beacons with optional filters and pagination.',
    {
      status: z.enum(['Draft', 'Active', 'PendingReview', 'Archived', 'Retired']).optional().describe('Filter by status'),
      project_id: z.string().uuid().optional().describe('Filter by project'),
      tags: z.string().optional().describe('Comma-separated tag filter'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(200).optional().describe('Page size (default 50)'),
      sort: z.string().optional().describe('Sort field (e.g. -updated_at)'),
    },
    async (params) => {
      const result = await client.request('GET', `/beacons${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing beacons', result.data);
    },
  );

  server.tool(
    'beacon_get',
    'Retrieve a single Beacon by ID or slug.',
    {
      id: z.string().describe('Beacon ID (UUID) or slug'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/beacons/${id}`);
      return result.ok ? ok(result.data) : err('getting beacon', result.data);
    },
  );

  server.tool(
    'beacon_update',
    'Update a Beacon (creates a new version). Provide only the fields to change.',
    {
      id: z.string().uuid().describe('Beacon ID'),
      title: z.string().min(1).max(500).optional().describe('Updated title'),
      summary: z.string().max(1000).optional().describe('Updated summary'),
      body: z.string().optional().describe('Updated body content'),
      tags: z.array(z.string()).optional().describe('Replace all tags'),
      visibility: z.enum(['Public', 'Organization', 'Project', 'Private']).optional().describe('Updated visibility'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('PUT', `/beacons/${id}`, body);
      return result.ok ? ok(result.data) : err('updating beacon', result.data);
    },
  );

  server.tool(
    'beacon_retire',
    'Retire (soft-delete) a Beacon.',
    {
      id: z.string().uuid().describe('Beacon ID'),
    },
    async ({ id }) => {
      const result = await client.request('DELETE', `/beacons/${id}`);
      return result.ok ? ok(result.data) : err('retiring beacon', result.data);
    },
  );

  server.tool(
    'beacon_publish',
    'Transition a Beacon from Draft to Active.',
    {
      id: z.string().uuid().describe('Beacon ID'),
    },
    async ({ id }) => {
      const result = await client.request('POST', `/beacons/${id}/publish`);
      return result.ok ? ok(result.data) : err('publishing beacon', result.data);
    },
  );

  server.tool(
    'beacon_verify',
    'Record a verification event on a Beacon (confirms content is still accurate).',
    {
      id: z.string().uuid().describe('Beacon ID'),
      notes: z.string().max(1000).optional().describe('Optional verification notes'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('POST', `/beacons/${id}/verify`, Object.keys(body).length ? body : undefined);
      return result.ok ? ok(result.data) : err('verifying beacon', result.data);
    },
  );

  server.tool(
    'beacon_challenge',
    'Flag a Beacon for review (challenge its accuracy or relevance).',
    {
      id: z.string().uuid().describe('Beacon ID'),
      reason: z.string().max(1000).optional().describe('Reason for the challenge'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('POST', `/beacons/${id}/challenge`, Object.keys(body).length ? body : undefined);
      return result.ok ? ok(result.data) : err('challenging beacon', result.data);
    },
  );

  server.tool(
    'beacon_restore',
    'Restore an Archived Beacon back to Active status.',
    {
      id: z.string().uuid().describe('Beacon ID'),
    },
    async ({ id }) => {
      const result = await client.request('POST', `/beacons/${id}/restore`);
      return result.ok ? ok(result.data) : err('restoring beacon', result.data);
    },
  );

  server.tool(
    'beacon_versions',
    'List the version history of a Beacon.',
    {
      id: z.string().uuid().describe('Beacon ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/beacons/${id}/versions`);
      return result.ok ? ok(result.data) : err('listing beacon versions', result.data);
    },
  );

  server.tool(
    'beacon_version_get',
    'Get a specific version of a Beacon.',
    {
      id: z.string().uuid().describe('Beacon ID'),
      version: z.number().int().positive().describe('Version number'),
    },
    async ({ id, version }) => {
      const result = await client.request('GET', `/beacons/${id}/versions/${version}`);
      return result.ok ? ok(result.data) : err('getting beacon version', result.data);
    },
  );

  // ===== SEARCH (4) =====

  server.tool(
    'beacon_search',
    'Hybrid semantic + keyword + graph search across Beacons.',
    {
      query: z.string().describe('Search query text'),
      filters: z.object({
        project_ids: z.array(z.string().uuid()).optional().describe('Limit to specific projects'),
        tags: z.array(z.string()).optional().describe('Filter by tags'),
        status: z.array(z.string()).optional().describe('Filter by status (e.g. Active, PendingReview)'),
        visibility_max: z.enum(['Public', 'Organization', 'Project', 'Private']).optional().describe('Visibility ceiling'),
        expires_after: z.string().optional().describe('ISO timestamp — only Beacons expiring after this date'),
      }).optional().describe('Search filters'),
      options: z.object({
        include_graph_expansion: z.boolean().optional().describe('Follow beacon_links from top results'),
        include_tag_expansion: z.boolean().optional().describe('Expand by shared tags'),
        include_fulltext_fallback: z.boolean().optional().describe('PostgreSQL ts_vector fallback'),
      }).optional().describe('Retrieval options'),
      top_k: z.number().int().min(0).max(100).optional().describe('Number of results (0 = count only)'),
      cursor: z.string().optional().describe('Pagination cursor'),
    },
    async (params) => {
      const result = await client.request('POST', '/search', params);
      return result.ok ? ok(result.data) : err('searching beacons', result.data);
    },
  );

  server.tool(
    'beacon_suggest',
    'Typeahead suggestions from the Beacon title/tag index.',
    {
      q: z.string().min(1).describe('Partial query text'),
      limit: z.number().int().positive().max(20).optional().describe('Max suggestions (default 10)'),
    },
    async (params) => {
      const result = await client.request('GET', `/search/suggest${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting suggestions', result.data);
    },
  );

  server.tool(
    'beacon_search_context',
    'Structured retrieval optimized for agent consumption — richer metadata, linked Beacons pre-fetched.',
    {
      query: z.string().describe('Search query text'),
      filters: z.object({
        project_ids: z.array(z.string().uuid()).optional(),
        tags: z.array(z.string()).optional(),
        status: z.array(z.string()).optional(),
      }).optional().describe('Search filters'),
      top_k: z.number().int().min(1).max(50).optional().describe('Number of results'),
    },
    async (params) => {
      const result = await client.request('POST', '/search/context', params);
      return result.ok ? ok(result.data) : err('searching beacon context', result.data);
    },
  );

  // ===== POLICY (3) =====

  server.tool(
    'beacon_policy_get',
    'Get the effective Beacon governance policy for the current scope.',
    {
      project_id: z.string().uuid().optional().describe('Project ID (omit for org-level policy)'),
    },
    async (params) => {
      const result = await client.request('GET', `/policies${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting policy', result.data);
    },
  );

  server.tool(
    'beacon_policy_set',
    'Set or update the Beacon governance policy at a given scope level.',
    {
      project_id: z.string().uuid().optional().describe('Project ID (omit for org-level)'),
      verification_interval_days: z.number().int().positive().optional().describe('Days between required verifications'),
      grace_period_days: z.number().int().min(0).optional().describe('Grace period before archiving'),
      auto_archive: z.boolean().optional().describe('Whether to auto-archive expired Beacons'),
      tag_affinity_threshold: z.number().int().min(1).max(5).optional().describe('Min shared tags for implicit graph edges'),
    },
    async (params) => {
      const result = await client.request('PUT', '/policies', params);
      return result.ok ? ok(result.data) : err('setting policy', result.data);
    },
  );

  server.tool(
    'beacon_policy_resolve',
    'Preview the resolved effective policy (merging org + project levels).',
    {
      project_id: z.string().uuid().optional().describe('Project ID to resolve for'),
    },
    async (params) => {
      const result = await client.request('GET', `/policies/resolve${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('resolving policy', result.data);
    },
  );

  // ===== TAGS & LINKS (5) =====

  server.tool(
    'beacon_tags_list',
    'List all tags in scope with usage counts.',
    {
      project_id: z.string().uuid().optional().describe('Filter tags by project scope'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(200).optional().describe('Page size'),
    },
    async (params) => {
      const result = await client.request('GET', `/tags${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing tags', result.data);
    },
  );

  server.tool(
    'beacon_tag_add',
    'Add one or more tags to a Beacon.',
    {
      id: z.string().uuid().describe('Beacon ID'),
      tags: z.array(z.string().min(1)).min(1).describe('Tags to add'),
    },
    async ({ id, tags }) => {
      const result = await client.request('POST', `/beacons/${id}/tags`, { tags });
      return result.ok ? ok(result.data) : err('adding tags', result.data);
    },
  );

  server.tool(
    'beacon_tag_remove',
    'Remove a tag from a Beacon.',
    {
      id: z.string().uuid().describe('Beacon ID'),
      tag: z.string().min(1).describe('Tag to remove'),
    },
    async ({ id, tag }) => {
      const result = await client.request('DELETE', `/beacons/${id}/tags/${encodeURIComponent(tag)}`);
      return result.ok ? ok(result.data) : err('removing tag', result.data);
    },
  );

  server.tool(
    'beacon_link_create',
    'Create a typed link between two Beacons.',
    {
      id: z.string().uuid().describe('Source Beacon ID'),
      target_id: z.string().uuid().describe('Target Beacon ID'),
      link_type: z.enum(['RelatedTo', 'Supersedes', 'DependsOn', 'ConflictsWith', 'SeeAlso']).describe('Link type'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('POST', `/beacons/${id}/links`, body);
      return result.ok ? ok(result.data) : err('creating link', result.data);
    },
  );

  server.tool(
    'beacon_link_remove',
    'Remove a link from a Beacon.',
    {
      id: z.string().uuid().describe('Source Beacon ID'),
      link_id: z.string().uuid().describe('Link ID to remove'),
    },
    async ({ id, link_id }) => {
      const result = await client.request('DELETE', `/beacons/${id}/links/${link_id}`);
      return result.ok ? ok(result.data) : err('removing link', result.data);
    },
  );

  // ===== SAVED QUERIES (4) =====

  server.tool(
    'beacon_query_save',
    'Save a named search query configuration for reuse.',
    {
      name: z.string().min(1).max(200).describe('Query name'),
      description: z.string().max(500).optional().describe('Short description'),
      query_body: z.record(z.unknown()).describe('Serialized search request body (same schema as beacon_search params)'),
      scope: z.enum(['Private', 'Project', 'Organization']).optional().describe('Sharing scope (default Private)'),
      project_id: z.string().uuid().optional().describe('Project ID (required if scope = Project)'),
    },
    async (params) => {
      const result = await client.request('POST', '/search/saved', params);
      return result.ok ? ok(result.data) : err('saving query', result.data);
    },
  );

  server.tool(
    'beacon_query_list',
    'List saved queries (own + shared in scope).',
    {
      scope: z.enum(['Private', 'Project', 'Organization']).optional().describe('Filter by scope'),
      project_id: z.string().uuid().optional().describe('Filter by project'),
    },
    async (params) => {
      const result = await client.request('GET', `/search/saved${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing saved queries', result.data);
    },
  );

  server.tool(
    'beacon_query_get',
    'Retrieve a saved query by ID.',
    {
      id: z.string().uuid().describe('Saved query ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/search/saved/${id}`);
      return result.ok ? ok(result.data) : err('getting saved query', result.data);
    },
  );

  server.tool(
    'beacon_query_delete',
    'Delete a saved query (owner only).',
    {
      id: z.string().uuid().describe('Saved query ID'),
    },
    async ({ id }) => {
      const result = await client.request('DELETE', `/search/saved/${id}`);
      return result.ok ? ok(result.data) : err('deleting saved query', result.data);
    },
  );

  // ===== GRAPH (3) =====

  server.tool(
    'beacon_graph_neighbors',
    'Get nodes and edges within N hops of a focal Beacon for graph exploration.',
    {
      beacon_id: z.string().uuid().describe('Focal Beacon ID'),
      hops: z.number().int().min(1).max(3).optional().describe('Traversal depth (default 1)'),
      include_implicit: z.boolean().optional().describe('Include tag-affinity edges (default true)'),
      tag_affinity_threshold: z.number().int().min(1).max(5).optional().describe('Minimum shared tags for implicit edge (default 2)'),
      status: z.string().optional().describe('Comma-separated status filter (e.g. Active,PendingReview)'),
    },
    async (params) => {
      const result = await client.request('GET', `/graph/neighbors${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting graph neighbors', result.data);
    },
  );

  server.tool(
    'beacon_graph_hubs',
    'Get the most-connected Beacons in scope (hub nodes for Knowledge Home).',
    {
      scope: z.enum(['project', 'organization']).optional().describe('Scope level (default project)'),
      project_id: z.string().uuid().optional().describe('Project ID (required if scope = project)'),
      top_k: z.number().int().min(1).max(50).optional().describe('Number of hub nodes (default 20)'),
    },
    async (params) => {
      const result = await client.request('GET', `/graph/hubs${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting graph hubs', result.data);
    },
  );

  server.tool(
    'beacon_graph_recent',
    'Get recently modified or verified Beacons.',
    {
      scope: z.enum(['project', 'organization']).optional().describe('Scope level (default project)'),
      project_id: z.string().uuid().optional().describe('Project ID (required if scope = project)'),
      days: z.number().int().min(1).max(90).optional().describe('Lookback window in days (default 7)'),
    },
    async (params) => {
      const result = await client.request('GET', `/graph/recent${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting recent beacons', result.data);
    },
  );
}
