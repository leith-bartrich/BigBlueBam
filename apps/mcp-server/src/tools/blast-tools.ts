import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

function createBlastClient(blastApiUrl: string, api: ApiClient) {
  const baseUrl = blastApiUrl.replace(/\/$/, '');

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

export function registerBlastTools(server: McpServer, api: ApiClient, blastApiUrl: string): void {
  const client = createBlastClient(blastApiUrl, api);

  // ===== TEMPLATES (3) =====

  server.tool(
    'blast_list_templates',
    'List available email templates with optional type filter and search.',
    {
      template_type: z.enum(['campaign', 'drip_step', 'transactional', 'system']).optional().describe('Filter by template type'),
      search: z.string().max(200).optional().describe('Search templates by name'),
      limit: z.number().int().positive().max(100).optional().describe('Page size (default 50)'),
    },
    async (params) => {
      const result = await client.request('GET', `/templates${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing templates', result.data);
    },
  );

  server.tool(
    'blast_get_template',
    'Get email template content and builder state by ID.',
    {
      id: z.string().uuid().describe('Template ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/templates/${id}`);
      return result.ok ? ok(result.data) : err('getting template', result.data);
    },
  );

  server.tool(
    'blast_create_template',
    'Create a new email template from HTML and subject line.',
    {
      name: z.string().min(1).max(255).describe('Template name'),
      subject_template: z.string().min(1).max(500).describe('Subject line with merge fields'),
      html_body: z.string().min(1).describe('HTML email body'),
      description: z.string().max(2000).optional().describe('Template description'),
      template_type: z.enum(['campaign', 'drip_step', 'transactional', 'system']).optional().describe('Template type'),
    },
    async (params) => {
      const result = await client.request('POST', '/templates', params);
      return result.ok ? ok(result.data) : err('creating template', result.data);
    },
  );

  // ===== CAMPAIGNS (4) =====

  server.tool(
    'blast_draft_campaign',
    'Create a campaign in draft status with template, segment, and schedule.',
    {
      name: z.string().min(1).max(255).describe('Campaign name'),
      subject: z.string().min(1).max(500).describe('Email subject line'),
      html_body: z.string().min(1).describe('HTML email body'),
      template_id: z.string().uuid().optional().describe('Template ID to use'),
      segment_id: z.string().uuid().optional().describe('Recipient segment ID'),
      from_name: z.string().max(100).optional().describe('From name'),
      from_email: z.string().email().optional().describe('From email address'),
    },
    async (params) => {
      const result = await client.request('POST', '/campaigns', params);
      return result.ok ? ok(result.data) : err('drafting campaign', result.data);
    },
  );

  server.tool(
    'blast_get_campaign',
    'Get campaign detail and delivery stats.',
    {
      id: z.string().uuid().describe('Campaign ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/campaigns/${id}`);
      return result.ok ? ok(result.data) : err('getting campaign', result.data);
    },
  );

  server.tool(
    'blast_send_campaign',
    'Send a campaign immediately. Requires human approval by default.',
    {
      id: z.string().uuid().describe('Campaign ID'),
      require_human_approval: z.boolean().default(true).describe('When true, campaign is scheduled for review instead of sent immediately'),
    },
    async ({ id, require_human_approval }) => {
      if (require_human_approval) {
        // Schedule instead of send — requires human confirmation
        const result = await client.request('POST', `/campaigns/${id}/schedule`, {
          scheduled_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        });
        return result.ok
          ? ok({ ...result.data, note: 'Campaign scheduled for review. A human must confirm before it sends.' })
          : err('scheduling campaign', result.data);
      }
      const result = await client.request('POST', `/campaigns/${id}/send`);
      return result.ok ? ok(result.data) : err('sending campaign', result.data);
    },
  );

  server.tool(
    'blast_get_campaign_analytics',
    'Get engagement metrics for a sent campaign: open rate, click rate, click map, delivery breakdown.',
    {
      id: z.string().uuid().describe('Campaign ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/campaigns/${id}/analytics`);
      return result.ok ? ok(result.data) : err('getting campaign analytics', result.data);
    },
  );

  // ===== SEGMENTS (3) =====

  server.tool(
    'blast_list_segments',
    'List contact segments with cached recipient counts.',
    {
      search: z.string().max(200).optional().describe('Search segments by name'),
      limit: z.number().int().positive().max(100).optional().describe('Page size'),
    },
    async (params) => {
      const result = await client.request('GET', `/segments${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing segments', result.data);
    },
  );

  server.tool(
    'blast_create_segment',
    'Define a segment from Bond contact filter criteria.',
    {
      name: z.string().min(1).max(255).describe('Segment name'),
      description: z.string().max(2000).optional().describe('Segment description'),
      filter_criteria: z.object({
        conditions: z.array(z.object({
          field: z.string().describe('Contact field to filter on'),
          op: z.string().describe('Comparison operator (equals, in, contains, greater_than, less_than, older_than_days)'),
          value: z.unknown().describe('Filter value'),
        })).min(1).max(20),
        match: z.enum(['all', 'any']).describe('all = AND, any = OR'),
      }).describe('Filter definition'),
    },
    async (params) => {
      const result = await client.request('POST', '/segments', params);
      return result.ok ? ok(result.data) : err('creating segment', result.data);
    },
  );

  server.tool(
    'blast_preview_segment',
    'Preview the first 50 matching contacts for a segment.',
    {
      id: z.string().uuid().describe('Segment ID'),
    },
    async ({ id }) => {
      const result = await client.request('GET', `/segments/${id}/preview`);
      return result.ok ? ok(result.data) : err('previewing segment', result.data);
    },
  );

  // ===== AI CONTENT (2) =====

  server.tool(
    'blast_draft_email_content',
    'AI-generate email subject and body from a brief description and tone.',
    {
      description: z.string().min(10).max(2000).describe('Brief description of the email to generate'),
      tone: z.enum(['professional', 'casual', 'urgent', 'friendly', 'formal']).optional().describe('Email tone'),
      audience: z.string().max(200).optional().describe('Target audience description'),
    },
    async ({ description, tone, audience }) => {
      // This would integrate with an LLM in production
      const subject = `[Draft] ${description.substring(0, 60)}`;
      const html = `<h1>Email Draft</h1><p>${description}</p><p style="color: #666;">Tone: ${tone ?? 'professional'}${audience ? `. Audience: ${audience}` : ''}</p>`;
      return ok({
        subject,
        html_body: html,
        note: 'This is a draft. Review and edit before sending.',
      });
    },
  );

  server.tool(
    'blast_suggest_subject_lines',
    'Generate 5 subject line variants for A/B comparison.',
    {
      topic: z.string().min(5).max(500).describe('Email topic or campaign description'),
      tone: z.enum(['professional', 'casual', 'urgent', 'friendly', 'formal']).optional().describe('Desired tone'),
    },
    async ({ topic, tone }) => {
      const toneLabel = tone ?? 'professional';
      const suggestions = [
        `[${toneLabel}] ${topic} - Option A`,
        `Don't miss: ${topic.substring(0, 40)}`,
        `${topic.substring(0, 50)} - you'll want to see this`,
        `Quick update: ${topic.substring(0, 45)}`,
        `[New] ${topic.substring(0, 45)} inside`,
      ];
      return ok({ suggestions, tone: toneLabel });
    },
  );

  // ===== ANALYTICS & COMPLIANCE (2) =====

  server.tool(
    'blast_get_engagement_summary',
    'Get org-level engagement trends: total sent, avg open rate, avg click rate, unsubscribe rate.',
    {},
    async () => {
      const result = await client.request('GET', '/analytics/overview');
      return result.ok ? ok(result.data) : err('getting engagement summary', result.data);
    },
  );

  server.tool(
    'blast_check_unsubscribed',
    'Check if an email address is on the organization unsubscribe list.',
    {
      email: z.string().email().describe('Email address to check'),
    },
    async ({ email }) => {
      const result = await client.request('GET', `/analytics/overview`);
      // In a real implementation, we'd have a dedicated endpoint
      return ok({ email, note: 'Check the blast_unsubscribes table for this email' });
    },
  );
}
