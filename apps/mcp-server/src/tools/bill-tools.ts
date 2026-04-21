import { registerTool } from '../lib/register-tool.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { isUuid } from '../middleware/resolve-helpers.js';

interface BillClient {
  request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; data: unknown }>;
}

function createBillClient(billApiUrl: string, api: ApiClient): BillClient {
  const baseUrl = billApiUrl.replace(/\/$/, '');

  async function request(method: string, path: string, body?: unknown) {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {};

    const token = (api as unknown as { token?: string }).token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }

  return { request };
}

/**
 * Resolve a billing client identifier that may be a UUID, a client name, or an email.
 *
 * Strategy: if already a UUID, return unchanged. Otherwise hit
 * `GET /clients?search=...&limit=5` (added in Phase C) and prefer an exact
 * case-insensitive match on name or email. If there is exactly one fuzzy
 * hit we accept it; otherwise we bail with `null` so the caller can surface
 * a clean "client not found / ambiguous" error rather than forwarding a
 * garbage UUID to the Bill API.
 */
async function resolveBillClientId(
  bill: BillClient,
  nameOrId: string,
): Promise<string | null> {
  if (isUuid(nameOrId)) return nameOrId;
  const result = await bill.request(
    'GET',
    `/clients?search=${encodeURIComponent(nameOrId)}&limit=5`,
  );
  if (!result.ok) return null;
  const envelope = result.data as {
    data?: Array<{ id: string; name: string; email?: string | null }>;
  } | null;
  const clients = envelope?.data ?? [];
  const needle = nameOrId.toLowerCase();
  const exact = clients.find(
    (c) =>
      c.name.toLowerCase() === needle ||
      (c.email?.toLowerCase() ?? '') === needle,
  );
  if (exact) return exact.id;
  if (clients.length === 1) return clients[0]!.id;
  return null;
}

/**
 * Resolve a Bam project identifier (UUID or name) to a UUID by listing
 * projects the caller can see and matching case-insensitively. Mirrors the
 * pattern in task-tools.ts — there is no dedicated `/projects/by-name`
 * endpoint, so we list and filter client-side.
 */
async function resolveBamProjectId(
  api: ApiClient,
  nameOrId: string,
): Promise<string | null> {
  if (isUuid(nameOrId)) return nameOrId;
  const result = await api.get('/projects?limit=200');
  if (!result.ok) return null;
  const envelope = result.data as { data?: Array<{ id: string; name: string }> } | null;
  const projects = envelope?.data ?? [];
  const needle = nameOrId.toLowerCase();
  const match = projects.find((p) => p.name.toLowerCase() === needle);
  return match?.id ?? null;
}

function notFound(label: string, value: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `${label} not found: ${value}`,
      },
    ],
    isError: true as const,
  };
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

const invoiceShape = z.object({
  id: z.string().uuid(),
  status: z.string(),
  client_id: z.string().uuid().optional(),
  project_id: z.string().uuid().nullable().optional(),
  total_cents: z.number().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

export function registerBillTools(server: McpServer, api: ApiClient, billApiUrl: string): void {
  const client = createBillClient(billApiUrl, api);

  // ===== 1. bill_list_invoices =====
  registerTool(server, {
    name: 'bill_list_invoices',
    description: 'List invoices, optionally filtered by status, client, project, or date range.',
    input: {
      status: z.string().optional().describe('Filter by status: draft, sent, viewed, paid, overdue, void'),
      client_id: z.string().uuid().optional().describe('Filter by client UUID'),
      project_id: z.string().uuid().optional().describe('Filter by Bam project UUID'),
      date_from: z.string().optional().describe('Filter invoices from this date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('Filter invoices to this date (YYYY-MM-DD)'),
    },
    returns: z.object({ data: z.array(invoiceShape) }),
    handler: async (params) => {
      const result = await client.request('GET', `/invoices${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing invoices', result.data);
    },
  });

  // ===== 2. bill_get_invoice =====
  registerTool(server, {
    name: 'bill_get_invoice',
    description: 'Get full invoice detail including line items and payments.',
    input: {
      invoice_id: z.string().uuid().describe('Invoice UUID'),
    },
    returns: invoiceShape.extend({ line_items: z.array(z.object({ id: z.string().uuid(), description: z.string(), unit_price: z.number() }).passthrough()).optional() }),
    handler: async (params) => {
      const result = await client.request('GET', `/invoices/${params.invoice_id}`);
      return result.ok ? ok(result.data) : err('getting invoice', result.data);
    },
  });

  // ===== 3. bill_create_invoice =====
  registerTool(server, {
    name: 'bill_create_invoice',
    description: 'Create a new blank draft invoice for a billing client.',
    input: {
      client_id: z
        .string()
        .describe(
          'Billing client — UUID, exact client name, or client email (resolved via bill_list_clients search)',
        ),
      project_id: z
        .string()
        .optional()
        .describe('Link to a Bam project — UUID or exact project name'),
      tax_rate: z.number().min(0).max(100).optional().describe('Tax rate percentage'),
      notes: z.string().optional().describe('Internal notes'),
    },
    returns: invoiceShape,
    handler: async (params) => {
      const clientId = await resolveBillClientId(client, params.client_id);
      if (!clientId) return notFound('Billing client', params.client_id);

      let projectId: string | undefined;
      if (params.project_id !== undefined) {
        const resolved = await resolveBamProjectId(api, params.project_id);
        if (!resolved) return notFound('Project', params.project_id);
        projectId = resolved;
      }

      const body = {
        ...params,
        client_id: clientId,
        ...(projectId !== undefined ? { project_id: projectId } : {}),
      };
      const result = await client.request('POST', '/invoices', body);
      return result.ok ? ok(result.data) : err('creating invoice', result.data);
    },
  });

  // ===== 4. bill_create_invoice_from_time =====
  registerTool(server, {
    name: 'bill_create_invoice_from_time',
    description: 'Generate an invoice from Bam time entries for a project and date range.',
    input: {
      project_id: z
        .string()
        .describe('Bam project — UUID or exact project name'),
      client_id: z
        .string()
        .describe('Billing client — UUID, exact client name, or client email'),
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
    },
    returns: invoiceShape,
    handler: async (params) => {
      const projectId = await resolveBamProjectId(api, params.project_id);
      if (!projectId) return notFound('Project', params.project_id);
      const clientId = await resolveBillClientId(client, params.client_id);
      if (!clientId) return notFound('Billing client', params.client_id);

      const body = { ...params, project_id: projectId, client_id: clientId };
      const result = await client.request('POST', '/invoices/from-time-entries', body);
      return result.ok ? ok(result.data) : err('creating invoice from time', result.data);
    },
  });

  // ===== 4b. bill_create_invoice_from_deal =====
  registerTool(server, {
    name: 'bill_create_invoice_from_deal',
    description: 'Generate a draft invoice from a Bond CRM deal, pulling deal value and contact info. ' +
      'NOTE: deal_id must be a UUID — Bond deal title search is not reachable from this tool. ' +
      'In a Bolt rule, pass `{{ event.deal.id }}` from the triggering deal.* event.',
    input: {
      deal_id: z
        .string()
        .uuid()
        .describe(
          'Bond deal UUID (required). In a Bolt rule, pass `{{ event.deal.id }}` from a deal.* event — deal title lookup is not supported here.',
        ),
      client_id: z
        .string()
        .describe('Billing client — UUID, exact client name, or client email'),
    },
    returns: invoiceShape,
    handler: async (params) => {
      const clientId = await resolveBillClientId(client, params.client_id);
      if (!clientId) return notFound('Billing client', params.client_id);

      const body = { ...params, client_id: clientId };
      const result = await client.request('POST', '/invoices/from-deal', body);
      return result.ok ? ok(result.data) : err('creating invoice from deal', result.data);
    },
  });

  // ===== 5. bill_add_line_item =====
  registerTool(server, {
    name: 'bill_add_line_item',
    description: 'Add a line item to a draft invoice.',
    input: {
      invoice_id: z.string().uuid().describe('Invoice UUID'),
      description: z.string().describe('Line item description'),
      quantity: z.number().positive().optional().describe('Quantity (default 1)'),
      unit_price: z.number().int().describe('Unit price in cents'),
      unit: z.string().optional().describe('Unit type: hours, days, units, fixed'),
    },
    returns: z.object({ id: z.string().uuid(), invoice_id: z.string().uuid(), description: z.string(), unit_price: z.number() }).passthrough(),
    handler: async (params) => {
      const { invoice_id, ...body } = params;
      const result = await client.request('POST', `/invoices/${invoice_id}/line-items`, body);
      return result.ok ? ok(result.data) : err('adding line item', result.data);
    },
  });

  // ===== 6. bill_finalize_invoice =====
  registerTool(server, {
    name: 'bill_finalize_invoice',
    description: 'Finalize a draft invoice — assigns an invoice number and locks edits.',
    input: {
      invoice_id: z.string().uuid().describe('Invoice UUID'),
    },
    returns: invoiceShape,
    handler: async (params) => {
      const result = await client.request('POST', `/invoices/${params.invoice_id}/finalize`);
      return result.ok ? ok(result.data) : err('finalizing invoice', result.data);
    },
  });

  // ===== 7. bill_send_invoice =====
  registerTool(server, {
    name: 'bill_send_invoice',
    description: 'Mark invoice as sent (triggers email delivery if configured).',
    input: {
      invoice_id: z.string().uuid().describe('Invoice UUID'),
    },
    returns: invoiceShape,
    handler: async (params) => {
      const result = await client.request('POST', `/invoices/${params.invoice_id}/send`);
      return result.ok ? ok(result.data) : err('sending invoice', result.data);
    },
  });

  // ===== 8. bill_record_payment =====
  registerTool(server, {
    name: 'bill_record_payment',
    description: 'Record a payment against an invoice.',
    input: {
      invoice_id: z.string().uuid().describe('Invoice UUID'),
      amount: z.number().int().positive().describe('Payment amount in cents'),
      payment_method: z.enum(['bank_transfer', 'credit_card', 'check', 'cash', 'stripe', 'paypal', 'other']).optional().describe('Payment method'),
      reference: z.string().optional().describe('Transaction reference or check number'),
    },
    returns: z.object({ id: z.string().uuid(), invoice_id: z.string().uuid(), amount: z.number(), paid_at: z.string() }).passthrough(),
    handler: async (params) => {
      const { invoice_id, ...body } = params;
      const result = await client.request('POST', `/invoices/${invoice_id}/payments`, body);
      return result.ok ? ok(result.data) : err('recording payment', result.data);
    },
  });

  // ===== 9. bill_get_overdue =====
  registerTool(server, {
    name: 'bill_get_overdue',
    description: 'List all overdue invoices with days overdue and amount due.',
    input: {},
    returns: z.object({ data: z.array(invoiceShape.extend({ days_overdue: z.number() })) }),
    handler: async () => {
      const result = await client.request('GET', '/reports/overdue');
      return result.ok ? ok(result.data) : err('getting overdue', result.data);
    },
  });

  // ===== 10. bill_get_revenue_summary =====
  registerTool(server, {
    name: 'bill_get_revenue_summary',
    description: 'Get revenue summary by month, showing total invoiced and collected.',
    input: {
      date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    },
    returns: z.object({ data: z.array(z.object({ month: z.string(), invoiced_cents: z.number(), collected_cents: z.number() }).passthrough()) }),
    handler: async (params) => {
      const result = await client.request('GET', `/reports/revenue${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting revenue', result.data);
    },
  });

  // ===== 11. bill_get_profitability =====
  registerTool(server, {
    name: 'bill_get_profitability',
    description: 'Get project profitability: invoiced revenue vs. logged expenses per project.',
    input: {},
    returns: z.object({ data: z.array(z.object({ project_id: z.string().uuid(), revenue_cents: z.number(), expense_cents: z.number() }).passthrough()) }),
    handler: async () => {
      const result = await client.request('GET', '/reports/profitability');
      return result.ok ? ok(result.data) : err('getting profitability', result.data);
    },
  });

  // ===== 12. bill_list_expenses =====
  registerTool(server, {
    name: 'bill_list_expenses',
    description: 'List expenses, optionally filtered by project, category, or status.',
    input: {
      project_id: z.string().uuid().optional().describe('Filter by project UUID'),
      category: z.string().optional().describe('Filter by category'),
      status: z.string().optional().describe('Filter by status: pending, approved, rejected, reimbursed'),
    },
    returns: z.object({ data: z.array(z.object({ id: z.string().uuid(), description: z.string(), amount: z.number(), status: z.string() }).passthrough()) }),
    handler: async (params) => {
      const result = await client.request('GET', `/expenses${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing expenses', result.data);
    },
  });

  // ===== 13. bill_create_expense =====
  registerTool(server, {
    name: 'bill_create_expense',
    description: 'Log a new expense, optionally linked to a project.',
    input: {
      description: z.string().describe('Expense description'),
      amount: z.number().int().positive().describe('Amount in cents'),
      category: z.string().optional().describe('Category: software, travel, hardware, contractor, etc.'),
      vendor: z.string().optional().describe('Vendor name'),
      project_id: z.string().uuid().optional().describe('Link to a Bam project'),
      billable: z.boolean().optional().describe('Whether this can be invoiced to a client'),
    },
    returns: z.object({ id: z.string().uuid(), description: z.string(), amount: z.number(), status: z.string() }).passthrough(),
    handler: async (params) => {
      const result = await client.request('POST', '/expenses', params);
      return result.ok ? ok(result.data) : err('creating expense', result.data);
    },
  });

  // ===== 14. bill_resolve_rate =====
  registerTool(server, {
    name: 'bill_resolve_rate',
    description: 'Resolve the effective billing rate for a given project + user + date.',
    input: {
      project_id: z.string().uuid().optional().describe('Project UUID'),
      user_id: z.string().uuid().optional().describe('User UUID'),
      date: z.string().optional().describe('Date to resolve for (YYYY-MM-DD, default today)'),
    },
    returns: z.object({ rate_cents_per_hour: z.number(), currency: z.string(), source: z.string().optional() }).passthrough(),
    handler: async (params) => {
      const result = await client.request('GET', `/rates/resolve${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('resolving rate', result.data);
    },
  });

  // ===== 15. bill_list_clients =====
  registerTool(server, {
    name: 'bill_list_clients',
    description: 'List billing clients for the organization, with optional fuzzy search across name, email, and linked Bond company name. Returns id, name, email, company_id, company_name, currency (org default), and default_payment_terms_days — the resolver surface every "bill client X" rule needs.',
    input: {
      search: z.string().optional().describe('Optional fuzzy search across client name, email, and Bond company name'),
    },
    returns: z.object({
      data: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string().nullable().optional(),
        company_id: z.string().uuid().nullable().optional(),
        company_name: z.string().nullable().optional(),
        currency: z.string().nullable().optional(),
        default_payment_terms_days: z.number().optional(),
      }).passthrough()),
    }),
    handler: async (params) => {
      const result = await client.request('GET', `/clients${buildQs(params)}`);
      if (!result.ok) return err('listing clients', result.data);

      const rows = (result.data as any)?.data ?? [];
      const clients = rows.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email ?? null,
        company_id: c.bond_company_id ?? null,
        company_name: c.company_name ?? null,
        currency: c.currency ?? null,
        default_payment_terms_days: c.default_payment_terms_days,
      }));
      return ok({ data: clients });
    },
  });
}
