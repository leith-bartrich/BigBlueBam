import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the database module
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: vi.fn(),
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
  return obj;
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const DOC_ID = '00000000-0000-0000-0000-000000000010';
const VERSION_ID = '00000000-0000-0000-0000-000000000040';

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: DOC_ID,
    org_id: ORG_ID,
    project_id: null,
    title: 'Test Doc',
    slug: 'test-doc',
    yjs_state: null,
    plain_text: 'Some text',
    html_snapshot: '<p>Some text</p>',
    word_count: 2,
    status: 'draft',
    visibility: 'project',
    created_by: USER_ID,
    updated_by: USER_ID,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION_ID,
    document_id: DOC_ID,
    version_number: 1,
    title: 'Test Doc',
    yjs_state: null,
    html_snapshot: '<p>Some text</p>',
    plain_text: 'Some text',
    word_count: 2,
    change_summary: null,
    created_by: USER_ID,
    created_at: new Date('2026-04-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// VersionError
// ---------------------------------------------------------------------------

describe('VersionError', () => {
  it('should create error with code, message, and status', async () => {
    const { VersionError } = await import('../src/services/version.service.js');
    const error = new VersionError('NOT_FOUND', 'Version not found', 404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Version not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('VersionError');
  });
});

// ---------------------------------------------------------------------------
// createVersion
// ---------------------------------------------------------------------------

describe('createVersion', () => {
  let createVersion: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/version.service.js');
    createVersion = mod.createVersion;
  });

  it('should create a named version snapshot', async () => {
    const doc = makeDocument();
    const version = makeVersion({ title: 'v1 snapshot', version_number: 1 });

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        // Get document
        return chainable([doc]);
      }
      // Get latest version number (none exist)
      return chainable([]);
    });

    mockInsert.mockReturnValue(chainable([version]));

    const result = await createVersion(DOC_ID, { title: 'v1 snapshot' }, USER_ID, ORG_ID);
    expect(result).toBeDefined();
    expect(result.version_number).toBe(1);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should increment version numbers correctly', async () => {
    const doc = makeDocument();
    const version = makeVersion({ version_number: 3 });

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return chainable([doc]);
      }
      // Latest version is 2
      return chainable([{ version_number: 2 }]);
    });

    mockInsert.mockReturnValue(chainable([version]));

    const result = await createVersion(DOC_ID, {}, USER_ID, ORG_ID);
    expect(result).toBeDefined();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should throw NOT_FOUND when document does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(
      createVersion(DOC_ID, { title: 'v1' }, USER_ID, ORG_ID),
    ).rejects.toThrow('Document not found');
  });

  it('should include word count and change summary in version', async () => {
    const doc = makeDocument({ word_count: 150 });
    const version = makeVersion({
      word_count: 150,
      change_summary: 'Added introduction section',
      version_number: 1,
    });

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return chainable([doc]);
      }
      return chainable([]);
    });

    mockInsert.mockReturnValue(chainable([version]));

    const result = await createVersion(
      DOC_ID,
      { change_summary: 'Added introduction section' },
      USER_ID,
      ORG_ID,
    );

    expect(result.word_count).toBe(150);
    expect(result.change_summary).toBe('Added introduction section');
  });
});

// ---------------------------------------------------------------------------
// listVersions
// ---------------------------------------------------------------------------

describe('listVersions', () => {
  let listVersions: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/version.service.js');
    listVersions = mod.listVersions;
  });

  it('should list versions for a document in descending order', async () => {
    const v1 = makeVersion({ version_number: 1, id: 'v1' });
    const v2 = makeVersion({ version_number: 2, id: 'v2' });

    mockSelect.mockReturnValue(chainable([v2, v1]));

    const result = await listVersions(DOC_ID);
    expect(result).toHaveLength(2);
    // yjs_state should be stripped
    expect(result[0].yjs_state).toBeUndefined();
    expect(result[1].yjs_state).toBeUndefined();
  });

  it('should return empty array when no versions exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listVersions(DOC_ID);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getVersion
// ---------------------------------------------------------------------------

describe('getVersion', () => {
  let getVersion: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/version.service.js');
    getVersion = mod.getVersion;
  });

  it('should get a specific version by document_id and version_id', async () => {
    const version = makeVersion();
    mockSelect.mockReturnValue(chainable([version]));

    const result = await getVersion(DOC_ID, VERSION_ID);
    expect(result).toBeDefined();
    expect(result.id).toBe(VERSION_ID);
    expect(result.document_id).toBe(DOC_ID);
  });

  it('should return null when version not found', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await getVersion(DOC_ID, 'nonexistent');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// restoreVersion
// ---------------------------------------------------------------------------

describe('restoreVersion', () => {
  let restoreVersion: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/version.service.js');
    restoreVersion = mod.restoreVersion;
  });

  it('should restore to a previous version and create a new version record', async () => {
    const doc = makeDocument();
    const version = makeVersion({
      version_number: 1,
      title: 'Old Title',
      plain_text: 'Old content',
    });
    const updatedDoc = makeDocument({ title: 'Old Title', plain_text: 'Old content' });

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        // getDocument
        return chainable([doc]);
      }
      if (selectCount === 2) {
        // getVersion
        return chainable([version]);
      }
      // getLatestVersionNumber for new restore snapshot
      return chainable([{ version_number: 1 }]);
    });

    mockUpdate.mockReturnValue(chainable([updatedDoc]));
    mockInsert.mockReturnValue(chainable([makeVersion({ version_number: 2 })]));

    const result = await restoreVersion(DOC_ID, VERSION_ID, USER_ID, ORG_ID);
    expect(result).toBeDefined();
    expect(result.title).toBe('Old Title');
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should throw NOT_FOUND when document does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(
      restoreVersion(DOC_ID, VERSION_ID, USER_ID, ORG_ID),
    ).rejects.toThrow('Document not found');
  });

  it('should throw NOT_FOUND when version does not exist', async () => {
    const doc = makeDocument();

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return chainable([doc]);
      }
      return chainable([]);
    });

    await expect(
      restoreVersion(DOC_ID, 'nonexistent', USER_ID, ORG_ID),
    ).rejects.toThrow('Version not found');
  });
});
