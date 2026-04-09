import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the database module
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const CLIENT_ID = '00000000-0000-0000-0000-000000000100';

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_ID,
    organization_id: ORG_ID,
    name: 'Acme Corp',
    email: 'billing@acme.com',
    phone: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state_region: null,
    postal_code: null,
    country: null,
    tax_id: null,
    bond_company_id: null,
    default_payment_terms_days: 30,
    default_payment_instructions: null,
    notes: null,
    created_by: USER_ID,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// listClients
// ---------------------------------------------------------------------------

describe('listClients', () => {
  let listClients: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/client.service.js');
    listClients = mod.listClients;
  });

  it('should return clients for org', async () => {
    const client = makeClient();
    mockSelect.mockReturnValue(chainable([client]));

    const result = await listClients({ organization_id: ORG_ID });
    expect(result.data).toHaveLength(1);
    expect(mockSelect).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getClient
// ---------------------------------------------------------------------------

describe('getClient', () => {
  let getClient: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/client.service.js');
    getClient = mod.getClient;
  });

  it('should return client by ID', async () => {
    const client = makeClient();
    mockSelect.mockReturnValue(chainable([client]));

    const result = await getClient(CLIENT_ID, ORG_ID);
    expect(result.id).toBe(CLIENT_ID);
    expect(result.name).toBe('Acme Corp');
  });

  it('should throw NOT_FOUND when client does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(getClient('nonexistent', ORG_ID)).rejects.toThrow('Client not found');
  });
});

// ---------------------------------------------------------------------------
// createClient
// ---------------------------------------------------------------------------

describe('createClient', () => {
  let createClient: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/client.service.js');
    createClient = mod.createClient;
  });

  it('should create a client', async () => {
    const client = makeClient();
    mockInsert.mockReturnValue(chainable([client]));

    const result = await createClient({ name: 'Acme Corp', email: 'billing@acme.com' }, ORG_ID, USER_ID);

    expect(result).toBeDefined();
    expect(result.name).toBe('Acme Corp');
    expect(mockInsert).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteClient
// ---------------------------------------------------------------------------

describe('deleteClient', () => {
  let deleteClient: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/client.service.js');
    deleteClient = mod.deleteClient;
  });

  it('should delete a client with no invoices', async () => {
    const client = makeClient();
    // getClient call
    mockSelect.mockReturnValueOnce(chainable([client]));
    // check for invoices
    mockSelect.mockReturnValueOnce(chainable([]));
    // delete
    mockDelete.mockReturnValue(chainable([{ id: CLIENT_ID }]));

    const result = await deleteClient(CLIENT_ID, ORG_ID);
    expect(result.id).toBe(CLIENT_ID);
  });

  it('should reject deleting client with invoices', async () => {
    const client = makeClient();
    // getClient call
    mockSelect.mockReturnValueOnce(chainable([client]));
    // check for invoices — found one
    mockSelect.mockReturnValueOnce(chainable([{ id: 'some-invoice' }]));

    await expect(deleteClient(CLIENT_ID, ORG_ID)).rejects.toThrow(
      'Cannot delete client with existing invoices',
    );
  });
});
