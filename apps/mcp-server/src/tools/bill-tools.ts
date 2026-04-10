import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

function createBillClient(billApiUrl: string, api: ApiClient) {
  const baseUrl = billApiUrl.replace(/\/$/, '');

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

export function registerBillTools(server: McpServer, api: ApiClient, billApiUrl: string): void {
  const client = createBillClient(billApiUrl, api);

  // ===== 1. bill_list_invoices =====
  server.tool(
    'bill_list_invoices',
    'List invoices, optionally filtered by status, client, project, or date range.',
    {
      status: z.string().optional().describe('Filter by status: draft, sent, viewed, paid, overdue, void'),
      client_id: z.string().uuid().optional().describe('Filter by client UUID'),
      project_id: z.string().uuid().optional().describe('Filter by Bam project UUID'),
      date_from: z.string().optional().describe('Filter invoices from this date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('Filter invoices to this date (YYYY-MM-DD)'),
    },
    async (params) => {
      const result = await client.request('GET', `/invoices${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing invoices', result.data);
    },
  );

  // ===== 2. bill_get_invoice =====
  server.tool(
    'bill_get_invoice',
    'Get full invoice detail including line items and payments.',
    {
      invoice_id: z.string().uuid().describe('Invoice UUID'),
    },
    async (params) => {
      const result = await client.request('GET', `/invoices/${params.invoice_id}`);
      return result.ok ? ok(result.data) : err('getting invoice', result.data);
    },
  );

  // ===== 3. bill_create_invoice =====
  server.tool(
    'bill_create_invoice',
    'Create a new blank draft invoice for a billing client.',
    {
      client_id: z.string().uuid().describe('Billing client UUID'),
      project_id: z.string().uuid().optional().describe('Link to a Bam project'),
      tax_rate: z.number().min(0).max(100).optional().describe('Tax rate percentage'),
      notes: z.string().optional().describe('Internal notes'),
    },
    async (params) => {
      const result = await client.request('POST', '/invoices', params);
      return result.ok ? ok(result.data) : err('creating invoice', result.data);
    },
  );

  // ===== 4. bill_create_invoice_from_time =====
  server.tool(
    'bill_create_invoice_from_time',
    'Generate an invoice from Bam time entries for a project and date range.',
    {
      project_id: z.string().uuid().describe('Bam project UUID'),
      client_id: z.string().uuid().describe('Billing client UUID'),
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
    },
    async (params) => {
      const result = await client.request('POST', '/invoices/from-time-entries', params);
      return result.ok ? ok(result.data) : err('creating invoice from time', result.data);
    },
  );

  // ===== 4b. bill_create_invoice_from_deal =====
  server.tool(
    'bill_create_invoice_from_deal',
    'Generate a draft invoice from a Bond CRM deal, pulling deal value and contact info.',
    {
      deal_id: z.string().uuid().describe('Bond deal UUID'),
      client_id: z.string().uuid().describe('Billing client UUID'),
    },
    async (params) => {
      const result = await client.request('POST', '/invoices/from-deal', params);
      return result.ok ? ok(result.data) : err('creating invoice from deal', result.data);
    },
  );

  // ===== 5. bill_add_line_item =====
  server.tool(
    'bill_add_line_item',
    'Add a line item to a draft invoice.',
    {
      invoice_id: z.string().uuid().describe('Invoice UUID'),
      description: z.string().describe('Line item description'),
      quantity: z.number().positive().optional().describe('Quantity (default 1)'),
      unit_price: z.number().int().describe('Unit price in cents'),
      unit: z.string().optional().describe('Unit type: hours, days, units, fixed'),
    },
    async (params) => {
      const { invoice_id, ...body } = params;
      const result = await client.request('POST', `/invoices/${invoice_id}/line-items`, body);
      return result.ok ? ok(result.data) : err('adding line item', result.data);
    },
  );

  // ===== 6. bill_finalize_invoice =====
  server.tool(
    'bill_finalize_invoice',
    'Finalize a draft invoice — assigns an invoice number and locks edits.',
    {
      invoice_id: z.string().uuid().describe('Invoice UUID'),
    },
    async (params) => {
      const result = await client.request('POST', `/invoices/${params.invoice_id}/finalize`);
      return result.ok ? ok(result.data) : err('finalizing invoice', result.data);
    },
  );

  // ===== 7. bill_send_invoice =====
  server.tool(
    'bill_send_invoice',
    'Mark invoice as sent (triggers email delivery if configured).',
    {
      invoice_id: z.string().uuid().describe('Invoice UUID'),
    },
    async (params) => {
      const result = await client.request('POST', `/invoices/${params.invoice_id}/send`);
      return result.ok ? ok(result.data) : err('sending invoice', result.data);
    },
  );

  // ===== 8. bill_record_payment =====
  server.tool(
    'bill_record_payment',
    'Record a payment against an invoice.',
    {
      invoice_id: z.string().uuid().describe('Invoice UUID'),
      amount: z.number().int().positive().describe('Payment amount in cents'),
      payment_method: z.enum(['bank_transfer', 'credit_card', 'check', 'cash', 'stripe', 'paypal', 'other']).optional().describe('Payment method'),
      reference: z.string().optional().describe('Transaction reference or check number'),
    },
    async (params) => {
      const { invoice_id, ...body } = params;
      const result = await client.request('POST', `/invoices/${invoice_id}/payments`, body);
      return result.ok ? ok(result.data) : err('recording payment', result.data);
    },
  );

  // ===== 9. bill_get_overdue =====
  server.tool(
    'bill_get_overdue',
    'List all overdue invoices with days overdue and amount due.',
    {},
    async () => {
      const result = await client.request('GET', '/reports/overdue');
      return result.ok ? ok(result.data) : err('getting overdue', result.data);
    },
  );

  // ===== 10. bill_get_revenue_summary =====
  server.tool(
    'bill_get_revenue_summary',
    'Get revenue summary by month, showing total invoiced and collected.',
    {
      date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    },
    async (params) => {
      const result = await client.request('GET', `/reports/revenue${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting revenue', result.data);
    },
  );

  // ===== 11. bill_get_profitability =====
  server.tool(
    'bill_get_profitability',
    'Get project profitability: invoiced revenue vs. logged expenses per project.',
    {},
    async () => {
      const result = await client.request('GET', '/reports/profitability');
      return result.ok ? ok(result.data) : err('getting profitability', result.data);
    },
  );

  // ===== 12. bill_list_expenses =====
  server.tool(
    'bill_list_expenses',
    'List expenses, optionally filtered by project, category, or status.',
    {
      project_id: z.string().uuid().optional().describe('Filter by project UUID'),
      category: z.string().optional().describe('Filter by category'),
      status: z.string().optional().describe('Filter by status: pending, approved, rejected, reimbursed'),
    },
    async (params) => {
      const result = await client.request('GET', `/expenses${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing expenses', result.data);
    },
  );

  // ===== 13. bill_create_expense =====
  server.tool(
    'bill_create_expense',
    'Log a new expense, optionally linked to a project.',
    {
      description: z.string().describe('Expense description'),
      amount: z.number().int().positive().describe('Amount in cents'),
      category: z.string().optional().describe('Category: software, travel, hardware, contractor, etc.'),
      vendor: z.string().optional().describe('Vendor name'),
      project_id: z.string().uuid().optional().describe('Link to a Bam project'),
      billable: z.boolean().optional().describe('Whether this can be invoiced to a client'),
    },
    async (params) => {
      const result = await client.request('POST', '/expenses', params);
      return result.ok ? ok(result.data) : err('creating expense', result.data);
    },
  );

  // ===== 14. bill_resolve_rate =====
  server.tool(
    'bill_resolve_rate',
    'Resolve the effective billing rate for a given project + user + date.',
    {
      project_id: z.string().uuid().optional().describe('Project UUID'),
      user_id: z.string().uuid().optional().describe('User UUID'),
      date: z.string().optional().describe('Date to resolve for (YYYY-MM-DD, default today)'),
    },
    async (params) => {
      const result = await client.request('GET', `/rates/resolve${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('resolving rate', result.data);
    },
  );

  // ===== 15. bill_list_clients =====
  server.tool(
    'bill_list_clients',
    'List billing clients for the organization, with optional fuzzy search across name, email, and linked Bond company name. Returns id, name, email, company_id, company_name, currency (org default), and default_payment_terms_days — the resolver surface every "bill client X" rule needs.',
    {
      search: z.string().optional().describe('Optional fuzzy search across client name, email, and Bond company name'),
    },
    async (params) => {
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
  );
}
