import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the database module
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: vi.fn(),
    delete: mockDelete,
    transaction: vi.fn(),
    execute: vi.fn(),
  },
  connection: { end: vi.fn() },
}));

vi.mock('../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 4005,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    S3_ENDPOINT: 'http://minio:9000',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin',
    S3_BUCKET: 'brief-uploads',
    S3_REGION: 'us-east-1',
    BBB_API_INTERNAL_URL: 'http://api:4000',
    BEACON_API_INTERNAL_URL: 'http://beacon-api:4004',
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
  return obj;
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ORG_ID_2 = '00000000-0000-0000-0000-000000000099';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const DOC_ID = '00000000-0000-0000-0000-000000000010';
const TASK_ID = '00000000-0000-0000-0000-000000000050';
const BEACON_ID = '00000000-0000-0000-0000-000000000060';
const LINK_ID = '00000000-0000-0000-0000-000000000070';

// ---------------------------------------------------------------------------
// LinkError
// ---------------------------------------------------------------------------

describe('LinkError', () => {
  it('should create error with code, message, and status', async () => {
    const { LinkError } = await import('../src/services/link.service.js');
    const error = new LinkError('NOT_FOUND', 'Link not found', 404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Link not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('LinkError');
  });
});

// ---------------------------------------------------------------------------
// createTaskLink
// ---------------------------------------------------------------------------

describe('createTaskLink', () => {
  let createTaskLink: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/link.service.js');
    createTaskLink = mod.createTaskLink;
  });

  it('should create a task link when document and task belong to same org', async () => {
    const link = {
      id: LINK_ID,
      document_id: DOC_ID,
      task_id: TASK_ID,
      link_type: 'reference',
      created_by: USER_ID,
    };

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        // Verify document org
        return chainable([{ org_id: ORG_ID }]);
      }
      // Verify task org
      return chainable([{ org_id: ORG_ID }]);
    });

    mockInsert.mockReturnValue(chainable([link]));

    const result = await createTaskLink(DOC_ID, TASK_ID, 'reference', USER_ID, ORG_ID);
    expect(result).toBeDefined();
    expect(result.document_id).toBe(DOC_ID);
    expect(result.task_id).toBe(TASK_ID);
    expect(result.link_type).toBe('reference');
  });

  it('should return null when document belongs to different org (cross-org blocked)', async () => {
    mockSelect.mockReturnValue(chainable([{ org_id: ORG_ID_2 }]));

    const result = await createTaskLink(DOC_ID, TASK_ID, 'reference', USER_ID, ORG_ID);
    expect(result).toBeNull();
  });

  it('should return null when task belongs to different org (cross-org blocked)', async () => {
    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return chainable([{ org_id: ORG_ID }]);
      }
      // Task from different org
      return chainable([{ org_id: ORG_ID_2 }]);
    });

    const result = await createTaskLink(DOC_ID, TASK_ID, 'reference', USER_ID, ORG_ID);
    expect(result).toBeNull();
  });

  it('should return null when duplicate link (unique constraint via onConflictDoNothing)', async () => {
    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return chainable([{ org_id: ORG_ID }]);
      }
      return chainable([{ org_id: ORG_ID }]);
    });

    // onConflictDoNothing returns empty array
    mockInsert.mockReturnValue(chainable([]));

    const result = await createTaskLink(DOC_ID, TASK_ID, 'reference', USER_ID, ORG_ID);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createBeaconLink
// ---------------------------------------------------------------------------

describe('createBeaconLink', () => {
  let createBeaconLink: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/link.service.js');
    createBeaconLink = mod.createBeaconLink;
  });

  it('should create a beacon link when both belong to same org', async () => {
    const link = {
      id: LINK_ID,
      document_id: DOC_ID,
      beacon_id: BEACON_ID,
      link_type: 'reference',
      created_by: USER_ID,
    };

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return chainable([{ org_id: ORG_ID }]);
      }
      return chainable([{ organization_id: ORG_ID }]);
    });

    mockInsert.mockReturnValue(chainable([link]));

    const result = await createBeaconLink(DOC_ID, BEACON_ID, 'reference', USER_ID, ORG_ID);
    expect(result).toBeDefined();
    expect(result.beacon_id).toBe(BEACON_ID);
  });

  it('should return null when beacon belongs to different org (cross-org blocked)', async () => {
    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return chainable([{ org_id: ORG_ID }]);
      }
      return chainable([{ organization_id: ORG_ID_2 }]);
    });

    const result = await createBeaconLink(DOC_ID, BEACON_ID, 'reference', USER_ID, ORG_ID);
    expect(result).toBeNull();
  });

  it('should return null on duplicate beacon link', async () => {
    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return chainable([{ org_id: ORG_ID }]);
      }
      return chainable([{ organization_id: ORG_ID }]);
    });

    mockInsert.mockReturnValue(chainable([]));

    const result = await createBeaconLink(DOC_ID, BEACON_ID, 'reference', USER_ID, ORG_ID);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getLinks
// ---------------------------------------------------------------------------

describe('getLinks', () => {
  let getLinks: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/link.service.js');
    getLinks = mod.getLinks;
  });

  it('should return both task_links and beacon_links', async () => {
    const taskLink = { id: 'tl1', document_id: DOC_ID, task_id: TASK_ID, link_type: 'reference' };
    const beaconLink = { id: 'bl1', document_id: DOC_ID, beacon_id: BEACON_ID, link_type: 'source' };

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return chainable([taskLink]);
      }
      return chainable([beaconLink]);
    });

    const result = await getLinks(DOC_ID);
    expect(result.task_links).toHaveLength(1);
    expect(result.beacon_links).toHaveLength(1);
    expect(result.task_links[0].task_id).toBe(TASK_ID);
    expect(result.beacon_links[0].beacon_id).toBe(BEACON_ID);
  });

  it('should return empty arrays when no links exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await getLinks(DOC_ID);
    expect(result.task_links).toEqual([]);
    expect(result.beacon_links).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// deleteLink
// ---------------------------------------------------------------------------

describe('deleteLink', () => {
  let deleteLink: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/link.service.js');
    deleteLink = mod.deleteLink;
  });

  it('should delete a task link', async () => {
    const taskLink = { id: LINK_ID, document_id: DOC_ID, task_id: TASK_ID };
    mockDelete.mockReturnValue(chainable([taskLink]));

    const result = await deleteLink(LINK_ID, DOC_ID);
    expect(result).toBeDefined();
    expect(result.id).toBe(LINK_ID);
  });

  it('should fall back to beacon link deletion when task link not found', async () => {
    const beaconLink = { id: LINK_ID, document_id: DOC_ID, beacon_id: BEACON_ID };

    let deleteCount = 0;
    mockDelete.mockImplementation(() => {
      deleteCount++;
      if (deleteCount === 1) {
        // Task link delete returns empty
        return chainable([]);
      }
      // Beacon link delete succeeds
      return chainable([beaconLink]);
    });

    const result = await deleteLink(LINK_ID, DOC_ID);
    expect(result).toBeDefined();
    expect(result.beacon_id).toBe(BEACON_ID);
  });

  it('should return null when link not found in either table', async () => {
    mockDelete.mockReturnValue(chainable([]));

    const result = await deleteLink('nonexistent', DOC_ID);
    expect(result).toBeNull();
  });
});
