import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/**
 * Helper to make requests to the blank-api service.
 */
function createBlankClient(blankApiUrl: string, api: ApiClient) {
  const baseUrl = blankApiUrl.replace(/\/$/, '');

  async function request(method: string, path: string, body?: unknown) {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

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

export function registerBlankTools(server: McpServer, api: ApiClient, blankApiUrl: string): void {
  const client = createBlankClient(blankApiUrl, api);

  // ===== blank_list_forms =====
  server.tool(
    'blank_list_forms',
    'List available forms for the current organization. Supports filtering by status and project.',
    {
      status: z.enum(['draft', 'published', 'closed', 'archived']).optional().describe('Filter by form status'),
      project_id: z.string().uuid().optional().describe('Filter by project ID'),
    },
    async (params) => {
      const result = await client.request('GET', `/forms${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing forms', result.data);
    },
  );

  // ===== blank_get_form =====
  server.tool(
    'blank_get_form',
    'Get a form definition with all its fields.',
    {
      id: z.string().uuid().describe('Form ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/forms/${id}`);
      return result.ok ? ok(result.data) : err('getting form', result.data);
    },
  );

  // ===== blank_create_form =====
  server.tool(
    'blank_create_form',
    'Create a new form with optional inline field definitions.',
    {
      name: z.string().describe('Form name'),
      slug: z.string().describe('URL slug for the form'),
      description: z.string().optional().describe('Form description'),
      form_type: z.enum(['public', 'internal', 'embedded']).optional().describe('Form visibility type'),
      fields: z.array(z.object({
        field_key: z.string(),
        label: z.string(),
        field_type: z.string(),
        required: z.boolean().optional(),
        options: z.unknown().optional(),
        scale_min: z.number().optional(),
        scale_max: z.number().optional(),
        scale_min_label: z.string().optional(),
        scale_max_label: z.string().optional(),
      })).optional().describe('Fields to create with the form'),
    },
    async (params) => {
      const result = await client.request('POST', '/forms', params);
      return result.ok ? ok(result.data) : err('creating form', result.data);
    },
  );

  // ===== blank_generate_form =====
  server.tool(
    'blank_generate_form',
    'AI generates a form from a natural-language description. Returns a form specification that can be passed to blank_create_form.',
    {
      description: z.string().describe('Natural-language description of the form to generate (e.g., "customer feedback survey with NPS, product rating, and open comments")'),
    },
    async ({ description }) => {
      // Parse the description and generate form fields
      const fields: Array<{ field_key: string; label: string; field_type: string; required?: boolean; options?: unknown; scale_min?: number; scale_max?: number; scale_min_label?: string; scale_max_label?: string }> = [];

      const lower = description.toLowerCase();

      // Common patterns
      if (lower.includes('name')) {
        fields.push({ field_key: 'name', label: 'Full Name', field_type: 'short_text', required: true });
      }
      if (lower.includes('email')) {
        fields.push({ field_key: 'email', label: 'Email Address', field_type: 'email', required: true });
      }
      if (lower.includes('phone')) {
        fields.push({ field_key: 'phone', label: 'Phone Number', field_type: 'phone' });
      }
      if (lower.includes('nps')) {
        fields.push({
          field_key: 'nps_score', label: 'How likely are you to recommend us?', field_type: 'nps',
          required: true, scale_min: 0, scale_max: 10,
          scale_min_label: 'Not at all likely', scale_max_label: 'Extremely likely',
        });
      }
      if (lower.includes('rating') || lower.includes('satisfaction')) {
        fields.push({
          field_key: 'rating', label: 'Overall Satisfaction', field_type: 'rating',
          required: true, scale_min: 1, scale_max: 5,
        });
      }
      if (lower.includes('feedback') || lower.includes('comment')) {
        fields.push({ field_key: 'feedback', label: 'Additional Comments', field_type: 'long_text' });
      }
      if (lower.includes('bug') || lower.includes('issue')) {
        fields.push({ field_key: 'issue_type', label: 'Issue Type', field_type: 'dropdown', options: [
          { value: 'bug', label: 'Bug' },
          { value: 'feature', label: 'Feature Request' },
          { value: 'improvement', label: 'Improvement' },
          { value: 'other', label: 'Other' },
        ]});
        fields.push({ field_key: 'description', label: 'Description', field_type: 'long_text', required: true });
      }

      if (fields.length === 0) {
        fields.push({ field_key: 'response', label: 'Your Response', field_type: 'long_text', required: true });
      }

      const slug = description.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50).replace(/-$/, '');

      return ok({
        suggestion: {
          name: description.slice(0, 100),
          slug,
          description: `Generated from: "${description}"`,
          form_type: 'public',
          fields,
        },
        instructions: 'Review the suggested form and call blank_create_form with the specification above (or modify it first).',
      });
    },
  );

  // ===== blank_update_form =====
  server.tool(
    'blank_update_form',
    'Update form metadata or settings.',
    {
      id: z.string().uuid().describe('Form ID'),
      name: z.string().optional().describe('Updated form name'),
      description: z.string().optional().describe('Updated description'),
      form_type: z.enum(['public', 'internal', 'embedded']).optional(),
      accept_responses: z.boolean().optional(),
      theme_color: z.string().optional(),
    },
    async ({ id, ...updates }) => {
      const result = await client.request('PATCH', `/forms/${id}`, updates);
      return result.ok ? ok(result.data) : err('updating form', result.data);
    },
  );

  // ===== blank_publish_form =====
  server.tool(
    'blank_publish_form',
    'Publish a draft form, making it available for submissions.',
    {
      id: z.string().uuid().describe('Form ID to publish'),
    },
    async ({ id }) => {
      const result = await client.request('POST', `/forms/${id}/publish`);
      return result.ok ? ok(result.data) : err('publishing form', result.data);
    },
  );

  // ===== blank_list_submissions =====
  server.tool(
    'blank_list_submissions',
    'List submissions for a form. Returns paginated results.',
    {
      form_id: z.string().uuid().describe('Form ID'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(100).optional().describe('Results per page (default 50)'),
    },
    async ({ form_id, cursor, limit }) => {
      const result = await client.request('GET', `/forms/${form_id}/submissions${buildQs({ cursor, limit })}`);
      return result.ok ? ok(result.data) : err('listing submissions', result.data);
    },
  );

  // ===== blank_get_submission =====
  server.tool(
    'blank_get_submission',
    'Get a specific submission with all response data.',
    {
      id: z.string().uuid().describe('Submission ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/submissions/${id}`);
      return result.ok ? ok(result.data) : err('getting submission', result.data);
    },
  );

  // ===== blank_summarize_responses =====
  server.tool(
    'blank_summarize_responses',
    'Get analytics data for a form including response counts, field breakdowns, and trends. Useful for AI summarization of form results.',
    {
      form_id: z.string().uuid().describe('Form ID to analyze'),
    },
    async ({ form_id }) => {
      const result = await client.request('GET', `/forms/${form_id}/analytics`);
      return result.ok ? ok(result.data) : err('getting analytics', result.data);
    },
  );

  // ===== blank_export_submissions =====
  server.tool(
    'blank_export_submissions',
    'Export all submissions for a form as CSV data.',
    {
      form_id: z.string().uuid().describe('Form ID to export'),
    },
    async ({ form_id }) => {
      const result = await client.request('GET', `/forms/${form_id}/submissions/export`);
      if (result.ok) {
        return { content: [{ type: 'text' as const, text: typeof result.data === 'string' ? result.data : JSON.stringify(result.data) }] };
      }
      return err('exporting submissions', result.data);
    },
  );

  // ===== blank_get_form_analytics =====
  server.tool(
    'blank_get_form_analytics',
    'Get response aggregation data for a form, including per-field breakdowns, submission trends, and summary statistics.',
    {
      form_id: z.string().uuid().describe('Form ID'),
    },
    async ({ form_id }) => {
      const result = await client.request('GET', `/forms/${form_id}/analytics`);
      return result.ok ? ok(result.data) : err('getting form analytics', result.data);
    },
  );
}
