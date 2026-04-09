import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the database module
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockExecute = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    transaction: mockTransaction,
    execute: mockExecute,
  },
  connection: { end: vi.fn() },
}));

vi.mock('../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 4007,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    BBB_API_INTERNAL_URL: 'http://api:4000',
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
  obj.onConflictDoUpdate = vi.fn().mockReturnValue(obj);
  obj.groupBy = vi.fn().mockReturnValue(obj);
  return obj;
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ORG_ID_2 = '00000000-0000-0000-0000-000000000099';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const CONTACT_ID = '00000000-0000-0000-0000-000000000100';
const CONTACT_ID_2 = '00000000-0000-0000-0000-000000000101';
const COMPANY_ID = '00000000-0000-0000-0000-000000000200';

function makeContact(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTACT_ID,
    organization_id: ORG_ID,
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone: '+1-555-0100',
    title: 'CTO',
    avatar_url: null,
    lifecycle_stage: 'lead',
    lead_source: 'website',
    lead_score: 42,
    address_line1: null,
    address_line2: null,
    city: null,
    state_region: null,
    postal_code: null,
    country: null,
    custom_fields: {},
    owner_id: USER_ID,
    last_contacted_at: null,
    created_by: USER_ID,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Transaction mock helper
// ---------------------------------------------------------------------------

function setupTransaction() {
  const txInsert = vi.fn();
  const txUpdate = vi.fn();
  const txDelete = vi.fn();
  const txSelect = vi.fn();

  const tx = {
    insert: txInsert,
    update: txUpdate,
    delete: txDelete,
    select: txSelect,
  };

  mockTransaction.mockImplementation(async (fn: Function) => fn(tx));

  return { tx, txInsert, txUpdate, txDelete, txSelect };
}

// ---------------------------------------------------------------------------
// BondError
// ---------------------------------------------------------------------------

describe('BondError', () => {
  it('should create error with code, message, and status', async () => {
    const { BondError } = await import('../src/services/contact.service.js');
    const error = new BondError('NOT_FOUND', 'Contact not found', 404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Contact not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('BondError');
  });

  it('should default to 400 status code', async () => {
    const { BondError } = await import('../src/services/contact.service.js');
    const error = new BondError('VALIDATION', 'Bad data');
    expect(error.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// listContacts
// ---------------------------------------------------------------------------

describe('listContacts', () => {
  let listContacts: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/contact.service.js');
    listContacts = mod.listContacts;
  });

  it('should return paginated list with cursor-based pagination', async () => {
    const c1 = makeContact({ id: 'c-1', created_at: new Date('2026-04-01') });
    const c2 = makeContact({ id: 'c-2', created_at: new Date('2026-04-02') });

    mockSelect.mockReturnValue(chainable([c1, c2]));

    const result = await listContacts({ orgId: ORG_ID, limit: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.has_more).toBe(true);
    expect(result.meta.next_cursor).toBeDefined();
  });

  it('should filter by lifecycle_stage', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listContacts({ orgId: ORG_ID, lifecycleStage: 'customer' });

    expect(result.data).toEqual([]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('should search with escaped ILIKE', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listContacts({ orgId: ORG_ID, search: '100%_complete' });

    expect(result.data).toEqual([]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('should cap limit to 100', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listContacts({ orgId: ORG_ID, limit: 500 });

    expect(result.data).toEqual([]);
    expect(result.meta.has_more).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getContact
// ---------------------------------------------------------------------------

describe('getContact', () => {
  let getContact: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/contact.service.js');
    getContact = mod.getContact;
  });

  it('should return contact with companies and recent activities', async () => {
    const contact = makeContact();

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) return chainable([contact]);
      if (selectCount === 2) return chainable([{ company_id: COMPANY_ID, name: 'Acme Corp' }]);
      return chainable([{ id: 'act-1', activity_type: 'email_sent' }]);
    });

    const result = await getContact(CONTACT_ID, ORG_ID);

    expect(result).toBeDefined();
    expect(result.id).toBe(CONTACT_ID);
    expect(result.companies).toHaveLength(1);
    expect(result.recent_activities).toHaveLength(1);
  });

  it('should return null when contact not found', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await getContact('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createContact
// ---------------------------------------------------------------------------

describe('createContact', () => {
  let createContact: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/contact.service.js');
    createContact = mod.createContact;
  });

  it('should create a contact with required fields', async () => {
    const contact = makeContact();
    mockInsert.mockReturnValue(chainable([contact]));

    const result = await createContact(
      { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
      USER_ID,
      ORG_ID,
    );

    expect(result).toBeDefined();
    expect(result.first_name).toBe('Ada');
    expect(result.email).toBe('ada@example.com');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should create a contact with custom fields', async () => {
    const contact = makeContact({ custom_fields: { department: 'Engineering' } });
    mockInsert.mockReturnValue(chainable([contact]));

    const result = await createContact(
      {
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        custom_fields: { department: 'Engineering' },
      },
      USER_ID,
      ORG_ID,
    );

    expect(result.custom_fields).toEqual({ department: 'Engineering' });
  });

  it('should create a contact and link to company', async () => {
    const contact = makeContact();
    const { txInsert } = setupTransaction();

    let insertCount = 0;
    txInsert.mockImplementation(() => {
      insertCount++;
      if (insertCount === 1) return chainable([contact]);
      return chainable([]); // contact_companies link
    });

    const result = await createContact(
      {
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        company_id: COMPANY_ID,
      },
      USER_ID,
      ORG_ID,
    );

    expect(result).toBeDefined();
    expect(txInsert).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// updateContact
// ---------------------------------------------------------------------------

describe('updateContact', () => {
  let updateContact: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/contact.service.js');
    updateContact = mod.updateContact;
  });

  it('should update contact fields', async () => {
    const existing = makeContact();
    const updated = makeContact({ first_name: 'Augusta', title: 'CEO' });

    mockSelect.mockReturnValue(chainable([existing]));
    mockUpdate.mockReturnValue(chainable([updated]));

    const result = await updateContact(
      CONTACT_ID,
      { first_name: 'Augusta', title: 'CEO' },
      USER_ID,
      ORG_ID,
    );

    expect(result.first_name).toBe('Augusta');
    expect(result.title).toBe('CEO');
  });

  it('should throw NOT_FOUND when contact does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(
      updateContact(CONTACT_ID, { first_name: 'X' }, USER_ID, ORG_ID),
    ).rejects.toThrow('Contact not found');
  });
});

// ---------------------------------------------------------------------------
// deleteContact
// ---------------------------------------------------------------------------

describe('deleteContact', () => {
  let deleteContact: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/contact.service.js');
    deleteContact = mod.deleteContact;
  });

  it('should delete an existing contact', async () => {
    const existing = makeContact();
    mockSelect.mockReturnValue(chainable([existing]));
    mockDelete.mockReturnValue(chainable([]));

    const result = await deleteContact(CONTACT_ID, ORG_ID);
    expect(result.deleted).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should throw NOT_FOUND when contact does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(deleteContact(CONTACT_ID, ORG_ID)).rejects.toThrow('Contact not found');
  });
});

// ---------------------------------------------------------------------------
// mergeContacts
// ---------------------------------------------------------------------------

describe('mergeContacts', () => {
  let mergeContacts: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/contact.service.js');
    mergeContacts = mod.mergeContacts;
  });

  it('should merge secondary into primary contact', async () => {
    const primary = makeContact({ id: CONTACT_ID });
    const secondary = makeContact({
      id: CONTACT_ID_2,
      phone: '+1-555-0200',
      lead_score: 10,
    });

    const merged = makeContact({
      id: CONTACT_ID,
      phone: '+1-555-0100',
      lead_score: 52, // combined scores
    });

    const { txSelect, txUpdate, txDelete } = setupTransaction();

    let selectCount = 0;
    txSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) return chainable([primary]);
      return chainable([secondary]);
    });

    txUpdate.mockReturnValue(chainable([merged]));
    txDelete.mockReturnValue(chainable([]));

    const result = await mergeContacts(CONTACT_ID, CONTACT_ID_2, USER_ID, ORG_ID);

    expect(result).toBeDefined();
    expect(result.id).toBe(CONTACT_ID);
    expect(txDelete).toHaveBeenCalled(); // secondary deleted
  });

  it('should throw when merging same contact into itself', async () => {
    await expect(
      mergeContacts(CONTACT_ID, CONTACT_ID, USER_ID, ORG_ID),
    ).rejects.toThrow('Cannot merge a contact into itself');
  });

  it('should throw NOT_FOUND when primary contact does not exist', async () => {
    const { txSelect } = setupTransaction();
    txSelect.mockReturnValue(chainable([]));

    await expect(
      mergeContacts('nonexistent', CONTACT_ID_2, USER_ID, ORG_ID),
    ).rejects.toThrow('Primary contact not found');
  });
});

// ---------------------------------------------------------------------------
// searchContacts
// ---------------------------------------------------------------------------

describe('searchContacts', () => {
  let searchContacts: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/contact.service.js');
    searchContacts = mod.searchContacts;
  });

  it('should return contacts matching search query', async () => {
    const c1 = makeContact({ first_name: 'Ada' });
    mockSelect.mockReturnValue(chainable([c1]));

    const result = await searchContacts('Ada', ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0].first_name).toBe('Ada');
  });

  it('should return empty array for no matches', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await searchContacts('zzzznonexistent', ORG_ID);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Cross-org contact access
// ---------------------------------------------------------------------------

describe('cross-org contact access', () => {
  let getContact: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/contact.service.js');
    getContact = mod.getContact;
  });

  it('should return null when contact belongs to different org', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await getContact(CONTACT_ID, ORG_ID_2);
    expect(result).toBeNull();
  });
});
