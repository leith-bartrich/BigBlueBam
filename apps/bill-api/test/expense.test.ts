import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
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
  obj.groupBy = vi.fn().mockReturnValue(obj);
  return obj;
}

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const EXPENSE_ID = '00000000-0000-0000-0000-000000000300';

function makeExpense(overrides: Record<string, unknown> = {}) {
  return {
    id: EXPENSE_ID,
    organization_id: ORG_ID,
    project_id: null,
    description: 'GitHub subscription',
    amount: 2500,
    currency: 'USD',
    category: 'software',
    vendor: 'GitHub',
    expense_date: '2026-04-01',
    receipt_url: null,
    receipt_filename: null,
    status: 'pending',
    approved_by: null,
    billable: false,
    invoiced: false,
    invoice_id: null,
    submitted_by: USER_ID,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

describe('listExpenses', () => {
  let listExpenses: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/expense.service.js');
    listExpenses = mod.listExpenses;
  });

  it('should return expenses for org', async () => {
    mockSelect.mockReturnValue(chainable([makeExpense()]));
    const result = await listExpenses({ organization_id: ORG_ID });
    expect(result.data).toHaveLength(1);
  });
});

describe('createExpense', () => {
  let createExpense: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/expense.service.js');
    createExpense = mod.createExpense;
  });

  it('should create an expense', async () => {
    const exp = makeExpense();
    mockInsert.mockReturnValue(chainable([exp]));

    const result = await createExpense(
      { description: 'GitHub subscription', amount: 2500, category: 'software' },
      ORG_ID,
      USER_ID,
    );
    expect(result.description).toBe('GitHub subscription');
  });
});

describe('approveExpense', () => {
  let approveExpense: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/expense.service.js');
    approveExpense = mod.approveExpense;
  });

  it('should approve a pending expense', async () => {
    const exp = makeExpense({ status: 'pending' });
    mockSelect.mockReturnValue(chainable([exp]));
    mockUpdate.mockReturnValue(chainable([{ ...exp, status: 'approved', approved_by: USER_ID }]));

    const result = await approveExpense(EXPENSE_ID, ORG_ID, USER_ID);
    expect(result.status).toBe('approved');
  });

  it('should reject approving non-pending expense', async () => {
    const exp = makeExpense({ status: 'approved' });
    mockSelect.mockReturnValue(chainable([exp]));

    await expect(approveExpense(EXPENSE_ID, ORG_ID, USER_ID)).rejects.toThrow(
      'Only pending expenses can be approved',
    );
  });
});

describe('getExpense', () => {
  let getExpense: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/expense.service.js');
    getExpense = mod.getExpense;
  });

  it('should throw NOT_FOUND when expense does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));
    await expect(getExpense('nonexistent', ORG_ID)).rejects.toThrow('Expense not found');
  });
});
