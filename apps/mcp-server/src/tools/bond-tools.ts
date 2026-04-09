import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/**
 * Helper to make requests to the bond-api service.
 * Same pattern as bolt-tools.ts — a lightweight fetch wrapper that targets
 * the bond-api base URL and forwards the user's auth token.
 */
function createBondClient(bondApiUrl: string, api: ApiClient) {
  const baseUrl = bondApiUrl.replace(/\/$/, '');

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

export function registerBondTools(server: McpServer, api: ApiClient, bondApiUrl: string): void {
  const client = createBondClient(bondApiUrl, api);

  // ===== CONTACTS (5) =====

  server.tool(
    'bond_list_contacts',
    'Search and filter CRM contacts with pagination. Supports lifecycle stage, owner, company, lead score range, and custom field filters.',
    {
      lifecycle_stage: z.enum(['subscriber', 'lead', 'marketing_qualified', 'sales_qualified', 'opportunity', 'customer', 'evangelist', 'other']).optional().describe('Filter by lifecycle stage'),
      owner_id: z.string().uuid().optional().describe('Filter by owner user ID'),
      company_id: z.string().uuid().optional().describe('Filter by associated company'),
      lead_source: z.string().max(60).optional().describe('Filter by lead source (e.g., "website", "referral", "express_interest")'),
      lead_score_min: z.number().int().optional().describe('Minimum lead score'),
      lead_score_max: z.number().int().optional().describe('Maximum lead score'),
      search: z.string().max(200).optional().describe('Full-text search across name, email, and custom fields'),
      sort: z.string().optional().describe('Sort field with optional - prefix for descending (e.g., "-lead_score", "last_name")'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(100).optional().describe('Page size (default 50, max 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/contacts${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing contacts', result.data);
    },
  );

  server.tool(
    'bond_get_contact',
    'Get full contact detail including associated companies, deals, and recent activities.',
    {
      id: z.string().uuid().describe('Contact ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/contacts/${id}`);
      return result.ok ? ok(result.data) : err('getting contact', result.data);
    },
  );

  server.tool(
    'bond_create_contact',
    'Create a new CRM contact with identity, classification, and optional company association.',
    {
      first_name: z.string().max(100).optional().describe('First name'),
      last_name: z.string().max(100).optional().describe('Last name'),
      email: z.string().email().max(255).optional().describe('Email address'),
      phone: z.string().max(50).optional().describe('Phone number'),
      title: z.string().max(150).optional().describe('Job title'),
      lifecycle_stage: z.enum(['subscriber', 'lead', 'marketing_qualified', 'sales_qualified', 'opportunity', 'customer', 'evangelist', 'other']).optional().describe('Lifecycle stage (default "lead")'),
      lead_source: z.string().max(60).optional().describe('Lead source (e.g., "website", "referral", "express_interest")'),
      owner_id: z.string().uuid().optional().describe('Owner user ID'),
      company_id: z.string().uuid().optional().describe('Primary company ID to associate'),
      address_line1: z.string().max(255).optional().describe('Address line 1'),
      address_line2: z.string().max(255).optional().describe('Address line 2'),
      city: z.string().max(100).optional().describe('City'),
      state_region: z.string().max(100).optional().describe('State or region'),
      postal_code: z.string().max(20).optional().describe('Postal code'),
      country: z.string().length(2).optional().describe('ISO 3166-1 alpha-2 country code'),
      custom_fields: z.record(z.unknown()).optional().describe('Custom field values as key-value pairs'),
    },
    async (params) => {
      const result = await client.request('POST', '/contacts', params);
      return result.ok ? ok(result.data) : err('creating contact', result.data);
    },
  );

  server.tool(
    'bond_update_contact',
    'Update an existing contact. Provide only the fields to change.',
    {
      id: z.string().uuid().describe('Contact ID'),
      first_name: z.string().max(100).optional().describe('Updated first name'),
      last_name: z.string().max(100).optional().describe('Updated last name'),
      email: z.string().email().max(255).optional().describe('Updated email'),
      phone: z.string().max(50).optional().describe('Updated phone'),
      title: z.string().max(150).optional().describe('Updated job title'),
      lifecycle_stage: z.enum(['subscriber', 'lead', 'marketing_qualified', 'sales_qualified', 'opportunity', 'customer', 'evangelist', 'other']).optional().describe('Updated lifecycle stage'),
      lead_source: z.string().max(60).optional().describe('Updated lead source'),
      owner_id: z.string().uuid().optional().describe('Updated owner user ID'),
      address_line1: z.string().max(255).optional().describe('Updated address line 1'),
      address_line2: z.string().max(255).optional().describe('Updated address line 2'),
      city: z.string().max(100).optional().describe('Updated city'),
      state_region: z.string().max(100).optional().describe('Updated state or region'),
      postal_code: z.string().max(20).optional().describe('Updated postal code'),
      country: z.string().length(2).optional().describe('Updated country code'),
      custom_fields: z.record(z.unknown()).optional().describe('Updated custom field values'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('PATCH', `/contacts/${id}`, body);
      return result.ok ? ok(result.data) : err('updating contact', result.data);
    },
  );

  server.tool(
    'bond_merge_contacts',
    'Merge duplicate contacts. The target contact absorbs the source contact\'s deals, activities, and company associations. The source contact is soft-deleted.',
    {
      target_id: z.string().uuid().describe('Contact ID to keep (target)'),
      source_id: z.string().uuid().describe('Contact ID to merge into target (will be soft-deleted)'),
    },
    async ({ target_id, source_id }) => {
      const result = await client.request('POST', `/contacts/${target_id}/merge`, { source_id });
      return result.ok ? ok(result.data) : err('merging contacts', result.data);
    },
  );

  // ===== COMPANIES (4) =====

  server.tool(
    'bond_list_companies',
    'Search and filter CRM companies with pagination.',
    {
      search: z.string().max(200).optional().describe('Search by company name or domain'),
      industry: z.string().max(100).optional().describe('Filter by industry'),
      size_bucket: z.enum(['1-10', '11-50', '51-200', '201-1000', '1001-5000', '5000+']).optional().describe('Filter by company size'),
      owner_id: z.string().uuid().optional().describe('Filter by owner user ID'),
      sort: z.string().optional().describe('Sort field with optional - prefix (e.g., "-annual_revenue", "name")'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(100).optional().describe('Page size (default 50, max 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/companies${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing companies', result.data);
    },
  );

  server.tool(
    'bond_get_company',
    'Get full company detail including associated contacts, deals, and recent activities.',
    {
      id: z.string().uuid().describe('Company ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/companies/${id}`);
      return result.ok ? ok(result.data) : err('getting company', result.data);
    },
  );

  server.tool(
    'bond_create_company',
    'Create a new CRM company.',
    {
      name: z.string().max(255).describe('Company name'),
      domain: z.string().max(255).optional().describe('Company domain (e.g., "acme.com")'),
      industry: z.string().max(100).optional().describe('Industry'),
      size_bucket: z.enum(['1-10', '11-50', '51-200', '201-1000', '1001-5000', '5000+']).optional().describe('Company size bucket'),
      annual_revenue: z.number().int().optional().describe('Annual revenue in cents (USD)'),
      phone: z.string().max(50).optional().describe('Phone number'),
      website: z.string().url().optional().describe('Website URL'),
      address_line1: z.string().max(255).optional().describe('Address line 1'),
      address_line2: z.string().max(255).optional().describe('Address line 2'),
      city: z.string().max(100).optional().describe('City'),
      state_region: z.string().max(100).optional().describe('State or region'),
      postal_code: z.string().max(20).optional().describe('Postal code'),
      country: z.string().length(2).optional().describe('ISO 3166-1 alpha-2 country code'),
      owner_id: z.string().uuid().optional().describe('Owner user ID'),
      custom_fields: z.record(z.unknown()).optional().describe('Custom field values as key-value pairs'),
    },
    async (params) => {
      const result = await client.request('POST', '/companies', params);
      return result.ok ? ok(result.data) : err('creating company', result.data);
    },
  );

  server.tool(
    'bond_update_company',
    'Update an existing company. Provide only the fields to change.',
    {
      id: z.string().uuid().describe('Company ID'),
      name: z.string().max(255).optional().describe('Updated name'),
      domain: z.string().max(255).optional().describe('Updated domain'),
      industry: z.string().max(100).optional().describe('Updated industry'),
      size_bucket: z.enum(['1-10', '11-50', '51-200', '201-1000', '1001-5000', '5000+']).optional().describe('Updated size bucket'),
      annual_revenue: z.number().int().optional().describe('Updated annual revenue in cents'),
      phone: z.string().max(50).optional().describe('Updated phone'),
      website: z.string().url().optional().describe('Updated website'),
      address_line1: z.string().max(255).optional().describe('Updated address line 1'),
      address_line2: z.string().max(255).optional().describe('Updated address line 2'),
      city: z.string().max(100).optional().describe('Updated city'),
      state_region: z.string().max(100).optional().describe('Updated state or region'),
      postal_code: z.string().max(20).optional().describe('Updated postal code'),
      country: z.string().length(2).optional().describe('Updated country code'),
      owner_id: z.string().uuid().optional().describe('Updated owner user ID'),
      custom_fields: z.record(z.unknown()).optional().describe('Updated custom field values'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('PATCH', `/companies/${id}`, body);
      return result.ok ? ok(result.data) : err('updating company', result.data);
    },
  );

  // ===== DEALS (7) =====

  server.tool(
    'bond_list_deals',
    'Search and filter CRM deals with pagination. Supports pipeline, stage, owner, value range, and stale flag filters.',
    {
      pipeline_id: z.string().uuid().optional().describe('Filter by pipeline'),
      stage_id: z.string().uuid().optional().describe('Filter by pipeline stage'),
      owner_id: z.string().uuid().optional().describe('Filter by deal owner'),
      company_id: z.string().uuid().optional().describe('Filter by associated company'),
      contact_id: z.string().uuid().optional().describe('Filter by associated contact'),
      value_min: z.number().int().optional().describe('Minimum deal value in cents'),
      value_max: z.number().int().optional().describe('Maximum deal value in cents'),
      expected_close_before: z.string().optional().describe('Expected close date before (ISO date)'),
      expected_close_after: z.string().optional().describe('Expected close date after (ISO date)'),
      is_open: z.boolean().optional().describe('Filter open deals only (closed_at IS NULL)'),
      sort: z.string().optional().describe('Sort field (e.g., "-value", "expected_close_date", "-created_at")'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(100).optional().describe('Page size (default 50, max 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/deals${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing deals', result.data);
    },
  );

  server.tool(
    'bond_get_deal',
    'Get full deal detail including associated contacts, activities, and stage change history.',
    {
      id: z.string().uuid().describe('Deal ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/deals/${id}`);
      return result.ok ? ok(result.data) : err('getting deal', result.data);
    },
  );

  server.tool(
    'bond_create_deal',
    'Create a new deal in a pipeline.',
    {
      name: z.string().max(255).describe('Deal name'),
      pipeline_id: z.string().uuid().describe('Pipeline ID'),
      stage_id: z.string().uuid().optional().describe('Initial stage ID (defaults to first stage in pipeline)'),
      value: z.number().int().optional().describe('Deal value in cents'),
      currency: z.string().length(3).optional().describe('Currency code (default "USD")'),
      expected_close_date: z.string().optional().describe('Expected close date (ISO date)'),
      probability_pct: z.number().int().min(0).max(100).optional().describe('Win probability override (0-100)'),
      description: z.string().max(5000).optional().describe('Deal description'),
      owner_id: z.string().uuid().optional().describe('Deal owner user ID'),
      company_id: z.string().uuid().optional().describe('Primary company ID'),
      contact_ids: z.array(z.string().uuid()).optional().describe('Contact IDs to associate with the deal'),
      custom_fields: z.record(z.unknown()).optional().describe('Custom field values'),
    },
    async (params) => {
      const result = await client.request('POST', '/deals', params);
      return result.ok ? ok(result.data) : err('creating deal', result.data);
    },
  );

  server.tool(
    'bond_update_deal',
    'Update an existing deal. Provide only the fields to change.',
    {
      id: z.string().uuid().describe('Deal ID'),
      name: z.string().max(255).optional().describe('Updated name'),
      value: z.number().int().optional().describe('Updated value in cents'),
      currency: z.string().length(3).optional().describe('Updated currency'),
      expected_close_date: z.string().optional().describe('Updated expected close date'),
      probability_pct: z.number().int().min(0).max(100).optional().describe('Updated win probability'),
      description: z.string().max(5000).optional().describe('Updated description'),
      owner_id: z.string().uuid().optional().describe('Updated owner'),
      company_id: z.string().uuid().optional().describe('Updated primary company'),
      custom_fields: z.record(z.unknown()).optional().describe('Updated custom field values'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('PATCH', `/deals/${id}`, body);
      return result.ok ? ok(result.data) : err('updating deal', result.data);
    },
  );

  server.tool(
    'bond_move_deal_stage',
    'Move a deal to a new pipeline stage. Records stage history and emits a deal.stage_changed event for Bolt automations.',
    {
      id: z.string().uuid().describe('Deal ID'),
      stage_id: z.string().uuid().describe('Target stage ID'),
    },
    async ({ id, stage_id }) => {
      const result = await client.request('PATCH', `/deals/${id}/stage`, { stage_id });
      return result.ok ? ok(result.data) : err('moving deal stage', result.data);
    },
  );

  server.tool(
    'bond_close_deal_won',
    'Mark a deal as won. Sets closed_at, moves to the won stage, and emits a deal.won event for Bolt automations.',
    {
      id: z.string().uuid().describe('Deal ID'),
      close_reason: z.string().max(2000).optional().describe('Reason for winning the deal'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('POST', `/deals/${id}/won`, body);
      return result.ok ? ok(result.data) : err('closing deal as won', result.data);
    },
  );

  server.tool(
    'bond_close_deal_lost',
    'Mark a deal as lost. Sets closed_at, close_reason, and optionally the competitor who won. Emits a deal.lost event for Bolt automations.',
    {
      id: z.string().uuid().describe('Deal ID'),
      close_reason: z.string().max(2000).optional().describe('Reason for losing the deal'),
      lost_to_competitor: z.string().max(255).optional().describe('Competitor who won the deal'),
    },
    async ({ id, ...body }) => {
      const result = await client.request('POST', `/deals/${id}/lost`, body);
      return result.ok ? ok(result.data) : err('closing deal as lost', result.data);
    },
  );

  // ===== ACTIVITIES (1) =====

  server.tool(
    'bond_log_activity',
    'Log an activity (note, call, email, meeting, task, etc.) against a contact, deal, or both.',
    {
      activity_type: z.enum([
        'note', 'email_sent', 'email_received', 'call', 'meeting',
        'task', 'form_submission', 'custom',
      ]).describe('Type of activity'),
      contact_id: z.string().uuid().optional().describe('Contact ID to associate with'),
      deal_id: z.string().uuid().optional().describe('Deal ID to associate with'),
      company_id: z.string().uuid().optional().describe('Company ID to associate with'),
      subject: z.string().max(255).optional().describe('Activity subject/title'),
      body: z.string().max(10000).optional().describe('Activity body/notes'),
      performed_at: z.string().optional().describe('When the activity occurred (ISO datetime, defaults to now)'),
      metadata: z.record(z.unknown()).optional().describe('Additional activity-type-specific data'),
    },
    async (params) => {
      const result = await client.request('POST', '/activities', params);
      return result.ok ? ok(result.data) : err('logging activity', result.data);
    },
  );

  // ===== ANALYTICS (2) =====

  server.tool(
    'bond_get_pipeline_summary',
    'Get pipeline summary with deal count, total value, and weighted value per stage.',
    {
      pipeline_id: z.string().uuid().optional().describe('Pipeline ID (defaults to the org default pipeline)'),
    },
    async (params) => {
      const result = await client.request('GET', `/analytics/pipeline-summary${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting pipeline summary', result.data);
    },
  );

  server.tool(
    'bond_get_stale_deals',
    'List deals that have exceeded the rotting threshold for their current pipeline stage. Useful for stale deal follow-up automations.',
    {
      pipeline_id: z.string().uuid().optional().describe('Filter by pipeline'),
      owner_id: z.string().uuid().optional().describe('Filter by deal owner'),
      limit: z.number().int().positive().max(100).optional().describe('Max results (default 50, max 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/analytics/stale-deals${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting stale deals', result.data);
    },
  );

  // ===== LEAD SCORING (1) =====

  server.tool(
    'bond_score_lead',
    'Trigger lead score recalculation for a specific contact. Evaluates all enabled scoring rules and updates the cached lead_score on the contact.',
    {
      contact_id: z.string().uuid().describe('Contact ID to score'),
    },
    async ({ contact_id }) => {
      const result = await client.request('POST', '/scoring/recalculate', { contact_id });
      return result.ok ? ok(result.data) : err('scoring lead', result.data);
    },
  );

  // ===== FORECAST (1) =====

  server.tool(
    'bond_get_forecast',
    'Get revenue forecast from weighted pipeline value, broken into 30/60/90 day buckets based on expected close dates.',
    {
      pipeline_id: z.string().uuid().optional().describe('Pipeline ID (defaults to the org default pipeline)'),
    },
    async (params) => {
      const result = await client.request('GET', `/analytics/forecast${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting forecast', result.data);
    },
  );

  // ===== SEARCH (1) =====

  server.tool(
    'bond_search_contacts',
    'Full-text search across contact name, email, and phone. Returns contacts ranked by lead score.',
    {
      query: z.string().min(1).max(200).describe('Search query string'),
      limit: z.number().int().positive().max(100).optional().describe('Max results (default 20, max 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/contacts/search${buildQs({ q: params.query, limit: params.limit })}`);
      return result.ok ? ok(result.data) : err('searching contacts', result.data);
    },
  );
}
