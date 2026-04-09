import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockExecute = vi.fn();

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    execute: mockExecute,
  },
  connection: { end: vi.fn() },
}));

vi.mock('../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 4014,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    BBB_API_INTERNAL_URL: 'http://api:4000',
    PUBLIC_URL: 'http://localhost',
    COOKIE_SECURE: false,
  },
}));

function chainable(result: unknown[]) {
  const obj: any = {};
  obj.then = (resolve: Function, reject?: Function) =>
    Promise.resolve(result).then(resolve as any, reject as any);
  obj.limit = vi.fn().mockResolvedValue(result);
  obj.returning = vi.fn().mockResolvedValue(result);
  obj.from = vi.fn().mockReturnValue(obj);
  obj.where = vi.fn().mockReturnValue(obj);
  obj.orderBy = vi.fn().mockReturnValue(obj);
  obj.set = vi.fn().mockReturnValue(obj);
  obj.values = vi.fn().mockReturnValue(obj);
  obj.fields = vi.fn().mockReturnValue(obj);
  obj.innerJoin = vi.fn().mockReturnValue(obj);
  obj.leftJoin = vi.fn().mockReturnValue(obj);
  obj.onConflictDoNothing = vi.fn().mockReturnValue(obj);
  obj.groupBy = vi.fn().mockReturnValue(obj);
  obj.offset = vi.fn().mockReturnValue(obj);
  return obj;
}

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const INVOICE_ID = '00000000-0000-0000-0000-000000000200';
const CLIENT_ID = '00000000-0000-0000-0000-000000000100';

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    organization_id: ORG_ID,
    client_id: CLIENT_ID,
    project_id: null,
    invoice_number: 'DRAFT',
    invoice_date: '2026-04-01',
    due_date: '2026-05-01',
    status: 'draft',
    subtotal: 50000,
    tax_rate: '0',
    tax_amount: 0,
    discount_amount: 0,
    total: 50000,
    amount_paid: 0,
    currency: 'USD',
    from_name: 'BigBlue',
    from_email: null,
    from_address: null,
    from_logo_url: null,
    from_tax_id: null,
    to_name: 'Acme Corp',
    to_email: 'billing@acme.com',
    to_address: null,
    to_tax_id: null,
    payment_terms_days: 30,
    payment_instructions: null,
    notes: null,
    footer_text: null,
    terms_text: null,
    bond_deal_id: null,
    pdf_url: null,
    public_view_token: 'abcdef',
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_reminder_sent_at: null,
    created_by: USER_ID,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// listInvoices
// ---------------------------------------------------------------------------

describe('listInvoices', () => {
  let listInvoices: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/invoice.service.js');
    listInvoices = mod.listInvoices;
  });

  it('should return invoices for org', async () => {
    const inv = makeInvoice();
    mockSelect.mockReturnValue(chainable([inv]));

    const result = await listInvoices({ organization_id: ORG_ID });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].invoice_number).toBe('DRAFT');
  });
});

// ---------------------------------------------------------------------------
// getInvoice
// ---------------------------------------------------------------------------

describe('getInvoice', () => {
  let getInvoice: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/invoice.service.js');
    getInvoice = mod.getInvoice;
  });

  it('should return invoice with line items and payments', async () => {
    const inv = makeInvoice();
    // Invoice select
    mockSelect.mockReturnValueOnce(chainable([inv]));
    // Line items select
    mockSelect.mockReturnValueOnce(chainable([{ id: 'li-1', description: 'Work', amount: 50000 }]));
    // Payments select
    mockSelect.mockReturnValueOnce(chainable([]));

    const result = await getInvoice(INVOICE_ID, ORG_ID);
    expect(result.id).toBe(INVOICE_ID);
    expect(result.line_items).toHaveLength(1);
    expect(result.payments).toHaveLength(0);
  });

  it('should throw NOT_FOUND when invoice does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(getInvoice('nonexistent', ORG_ID)).rejects.toThrow('Invoice not found');
  });
});

// ---------------------------------------------------------------------------
// deleteInvoice
// ---------------------------------------------------------------------------

describe('deleteInvoice', () => {
  let deleteInvoice: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/invoice.service.js');
    deleteInvoice = mod.deleteInvoice;
  });

  it('should reject deleting non-draft invoice', async () => {
    const inv = makeInvoice({ status: 'sent' });
    mockSelect.mockReturnValueOnce(chainable([inv]));
    // line items
    mockSelect.mockReturnValueOnce(chainable([]));
    // payments
    mockSelect.mockReturnValueOnce(chainable([]));

    await expect(deleteInvoice(INVOICE_ID, ORG_ID)).rejects.toThrow(
      'Can only delete invoices in draft status',
    );
  });
});
