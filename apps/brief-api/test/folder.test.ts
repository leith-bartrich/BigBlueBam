import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the database module
// ---------------------------------------------------------------------------

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
const ORG_ID_2 = '00000000-0000-0000-0000-000000000099';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const FOLDER_ID = '00000000-0000-0000-0000-000000000020';
const PARENT_FOLDER_ID = '00000000-0000-0000-0000-000000000021';
const PROJECT_ID = '00000000-0000-0000-0000-000000000002';

function makeFolder(overrides: Record<string, unknown> = {}) {
  return {
    id: FOLDER_ID,
    org_id: ORG_ID,
    project_id: null,
    parent_id: null,
    name: 'Engineering',
    slug: 'engineering',
    sort_order: 0,
    created_by: USER_ID,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FolderError
// ---------------------------------------------------------------------------

describe('FolderError', () => {
  it('should create error with code, message, and status', async () => {
    const { FolderError } = await import('../src/services/folder.service.js');
    const error = new FolderError('NOT_FOUND', 'Folder not found', 404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Folder not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('FolderError');
  });
});

// ---------------------------------------------------------------------------
// createFolder
// ---------------------------------------------------------------------------

describe('createFolder', () => {
  let createFolder: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/folder.service.js');
    createFolder = mod.createFolder;
  });

  it('should create a folder with name and generate slug', async () => {
    const folder = makeFolder();

    // uniqueSlug check
    mockSelect.mockReturnValue(chainable([]));
    mockInsert.mockReturnValue(chainable([folder]));

    const result = await createFolder({ name: 'Engineering' }, USER_ID, ORG_ID);
    expect(result).toBeDefined();
    expect(result.name).toBe('Engineering');
    expect(result.slug).toBe('engineering');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should create a folder with parent_id', async () => {
    const folder = makeFolder({ parent_id: PARENT_FOLDER_ID });

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        // uniqueSlug check
        return chainable([]);
      }
      // Parent folder validation
      return chainable([{ org_id: ORG_ID }]);
    });

    mockInsert.mockReturnValue(chainable([folder]));

    const result = await createFolder(
      { name: 'Sub-Folder', parent_id: PARENT_FOLDER_ID },
      USER_ID,
      ORG_ID,
    );
    expect(result.parent_id).toBe(PARENT_FOLDER_ID);
  });

  it('should throw NOT_FOUND when parent folder belongs to different org', async () => {
    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        // uniqueSlug check
        return chainable([]);
      }
      // Parent folder from different org
      return chainable([{ org_id: ORG_ID_2 }]);
    });

    await expect(
      createFolder({ name: 'Sub', parent_id: PARENT_FOLDER_ID }, USER_ID, ORG_ID),
    ).rejects.toThrow('Parent folder not found');
  });
});

// ---------------------------------------------------------------------------
// listFolders
// ---------------------------------------------------------------------------

describe('listFolders', () => {
  let listFolders: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/folder.service.js');
    listFolders = mod.listFolders;
  });

  it('should list folder tree for an organization', async () => {
    const folder1 = makeFolder({ id: 'f1', name: 'Alpha', sort_order: 0 });
    const folder2 = makeFolder({ id: 'f2', name: 'Beta', sort_order: 1 });

    mockSelect.mockReturnValue(chainable([folder1, folder2]));

    const result = await listFolders(ORG_ID);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alpha');
    expect(result[1].name).toBe('Beta');
  });

  it('should filter folders by project_id', async () => {
    const folder = makeFolder({ project_id: PROJECT_ID });
    mockSelect.mockReturnValue(chainable([folder]));

    const result = await listFolders(ORG_ID, PROJECT_ID);
    expect(result).toHaveLength(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('should return empty array when no folders exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listFolders(ORG_ID);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updateFolder
// ---------------------------------------------------------------------------

describe('updateFolder', () => {
  let updateFolder: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/folder.service.js');
    updateFolder = mod.updateFolder;
  });

  it('should update folder name', async () => {
    const existing = makeFolder();
    const updated = makeFolder({ name: 'Design' });

    mockSelect.mockReturnValue(chainable([existing]));
    mockUpdate.mockReturnValue(chainable([updated]));

    const result = await updateFolder(FOLDER_ID, { name: 'Design' }, ORG_ID);
    expect(result.name).toBe('Design');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('should move folder by changing parent_id', async () => {
    const existing = makeFolder();
    const updated = makeFolder({ parent_id: PARENT_FOLDER_ID });

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        // Get existing folder
        return chainable([existing]);
      }
      // Validate parent folder
      return chainable([{ org_id: ORG_ID }]);
    });

    mockUpdate.mockReturnValue(chainable([updated]));

    const result = await updateFolder(
      FOLDER_ID,
      { parent_id: PARENT_FOLDER_ID },
      ORG_ID,
    );
    expect(result.parent_id).toBe(PARENT_FOLDER_ID);
  });

  it('should throw BAD_REQUEST when folder is set as its own parent', async () => {
    const existing = makeFolder();
    mockSelect.mockReturnValue(chainable([existing]));

    await expect(
      updateFolder(FOLDER_ID, { parent_id: FOLDER_ID }, ORG_ID),
    ).rejects.toThrow('Folder cannot be its own parent');
  });

  it('should throw NOT_FOUND when folder does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(
      updateFolder(FOLDER_ID, { name: 'New Name' }, ORG_ID),
    ).rejects.toThrow('Folder not found');
  });
});

// ---------------------------------------------------------------------------
// deleteFolder
// ---------------------------------------------------------------------------

describe('deleteFolder', () => {
  let deleteFolder: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/folder.service.js');
    deleteFolder = mod.deleteFolder;
  });

  it('should delete a folder', async () => {
    const existing = makeFolder();
    mockSelect.mockReturnValue(chainable([existing]));
    mockDelete.mockReturnValue(chainable([existing]));

    const result = await deleteFolder(FOLDER_ID, ORG_ID);
    expect(result).toBeDefined();
    expect(result.id).toBe(FOLDER_ID);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should throw NOT_FOUND when folder does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(deleteFolder(FOLDER_ID, ORG_ID)).rejects.toThrow('Folder not found');
  });
});
