import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { handleScopeError } from '../middleware/scope-check.js';

export function registerHelpdeskTools(server: McpServer, api: ApiClient, helpdeskApiUrl: string): void {
  /** Helper to make requests to the helpdesk-api service */
  async function helpdeskRequest(method: string, path: string, body?: unknown) {
    const url = `${helpdeskApiUrl}${path}`;
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

  server.tool(
    'list_tickets',
    'List helpdesk tickets with optional filters',
    {
      status: z.enum(['open', 'in_progress', 'waiting_on_client', 'resolved', 'closed']).optional().describe('Filter by ticket status'),
      assignee_id: z.string().uuid().optional().describe('Filter by assigned agent'),
      client_id: z.string().uuid().optional().describe('Filter by client'),
      cursor: z.string().optional().describe('Pagination cursor'),
      limit: z.number().int().positive().max(100).optional().describe('Number of results'),
    },
    async (params) => {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) searchParams.set(key, String(value));
      }
      const qs = searchParams.toString();
      const result = await helpdeskRequest('GET', `/tickets${qs ? `?${qs}` : ''}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing tickets: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'get_ticket',
    'Get detailed information about a helpdesk ticket including messages',
    {
      ticket_id: z.string().uuid().describe('The ticket ID'),
    },
    async ({ ticket_id }) => {
      const result = await helpdeskRequest('GET', `/tickets/${ticket_id}`);

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error getting ticket: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'reply_to_ticket',
    'Send a message on a helpdesk ticket (public reply or internal note)',
    {
      ticket_id: z.string().uuid().describe('The ticket ID'),
      body: z.string().min(1).describe('The message body'),
      is_internal: z.boolean().optional().default(false).describe('If true, post as an internal note (not visible to client)'),
    },
    async ({ ticket_id, body, is_internal }) => {
      const result = await helpdeskRequest('POST', `/tickets/${ticket_id}/messages`, {
        body,
        is_internal,
      });

      if (!result.ok) {
        const scopeErr = handleScopeError('reply_to_ticket', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error replying to ticket: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: `Message sent successfully.\n${JSON.stringify(result.data, null, 2)}` }],
      };
    },
  );

  server.tool(
    'update_ticket_status',
    'Update the status of a helpdesk ticket',
    {
      ticket_id: z.string().uuid().describe('The ticket ID'),
      status: z.enum(['open', 'in_progress', 'waiting_on_client', 'resolved', 'closed']).describe('The new status'),
    },
    async ({ ticket_id, status }) => {
      const result = await helpdeskRequest('PATCH', `/tickets/${ticket_id}`, { status });

      if (!result.ok) {
        const scopeErr = handleScopeError('update_ticket_status', 'read_write', result);
        if (scopeErr) return scopeErr;
        return {
          content: [{ type: 'text' as const, text: `Error updating ticket status: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: `Ticket status updated to "${status}".\n${JSON.stringify(result.data, null, 2)}` }],
      };
    },
  );

  server.tool(
    'helpdesk_get_public_settings',
    'Get public helpdesk settings (no auth required). Returns email verification requirement, categories, and welcome message.',
    {},
    async () => {
      const result = await helpdeskRequest('GET', '/helpdesk/public-settings');
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
        isError: !result.ok ? true : undefined,
      };
    },
  );

  server.tool(
    'helpdesk_get_settings',
    'Get full helpdesk configuration. Requires admin authentication — the caller\'s API key must belong to an org admin or owner.',
    {},
    async () => {
      const result = await helpdeskRequest('GET', '/helpdesk/settings');
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
        isError: !result.ok ? true : undefined,
      };
    },
  );

  server.tool(
    'helpdesk_update_settings',
    'Update helpdesk settings. Requires admin authentication.',
    {
      categories: z.array(z.string()).optional().describe('Ticket categories available to customers.'),
      welcome_message: z.string().max(2000).optional().describe('Welcome message shown to customers.'),
      require_email_verification: z.boolean().optional().describe('Whether customers must verify their email.'),
      allowed_email_domains: z.array(z.string()).optional().describe('If set, only these email domains can register.'),
    },
    async (params) => {
      const body: Record<string, unknown> = {};
      if (params.categories !== undefined) body.categories = params.categories;
      if (params.welcome_message !== undefined) body.welcome_message = params.welcome_message;
      if (params.require_email_verification !== undefined) body.require_email_verification = params.require_email_verification;
      if (params.allowed_email_domains !== undefined) body.allowed_email_domains = params.allowed_email_domains;

      const result = await helpdeskRequest('PATCH', '/helpdesk/settings', body);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
        isError: !result.ok ? true : undefined,
      };
    },
  );
}
