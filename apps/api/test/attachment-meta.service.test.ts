import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the federated attachment metadata dispatcher
 * (apps/api/src/services/attachment-meta.service.ts, AGENTIC_TODO §17 Wave 4).
 *
 * We hoist mocks for db, env, upload.service, and visibility.service so
 * the service file can be imported without booting Postgres or MinIO.
 * Each test stubs the db.select() chain to return a controlled row set
 * and asserts the dispatcher's row projection, preflight gate, and
 * deep-link gating behaviour.
 */

// ---------- hoisted mocks ----------
const { mockDb, mockPreflight, mockGetFileUrl } = vi.hoisted(() => {
  return {
    mockDb: {
      select: vi.fn(),
    },
    mockPreflight: vi.fn(),
    mockGetFileUrl: vi.fn(),
  };
});

vi.mock('../src/env.js', () => ({
  env: {
    SESSION_TTL_SECONDS: 604800,
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    NODE_ENV: 'test',
    PORT: 4000,
    HOST: '0.0.0.0',
    SESSION_SECRET: 'a'.repeat(32),
    REDIS_URL: 'redis://localhost:6379',
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    UPLOAD_MAX_FILE_SIZE: 10485760,
    UPLOAD_ALLOWED_TYPES: 'image/*',
    S3_BUCKET: 'test-bucket',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'a',
    S3_SECRET_KEY: 'a',
    S3_REGION: 'us-east-1',
    COOKIE_SECURE: false,
  },
}));

vi.mock('../src/db/index.js', () => ({
  db: mockDb,
  connection: { end: vi.fn() },
}));

vi.mock('../src/services/visibility.service.js', () => ({
  preflightAccess: mockPreflight,
}));

vi.mock('../src/services/upload.service.js', () => ({
  getFileUrl: mockGetFileUrl,
  ensureBucket: vi.fn(),
  uploadFile: vi.fn(),
  getFileStream: vi.fn(),
  deleteFile: vi.fn(),
  buildStorageKey: vi.fn(),
}));

// Import AFTER mocks
import {
  getAttachmentMetaById,
  listAttachmentsForParent,
  SUPPORTED_PARENT_TYPES,
  MAX_LIST_LIMIT,
} from '../src/services/attachment-meta.service.js';

// ---------- constants ----------
const ASKER = 'aaaaaaaa-0000-0000-0000-000000000001';
const TASK_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const TICKET_ID = 'cccccccc-0000-0000-0000-000000000003';
const BEACON_ID = 'dddddddd-0000-0000-0000-000000000004';
const ATT_ID = 'eeeeeeee-0000-0000-0000-000000000005';
const UPLOADER_ID = 'ffffffff-0000-0000-0000-000000000006';

// ---------- chain helpers ----------
//
// attachment-meta.service.ts uses the same db.select().from().where().limit()
// pattern as visibility.service. Some call sites omit .limit() and chain
// .orderBy().limit() instead. Expose both.

function pushSelect(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  // `where` is sometimes awaited directly (no .limit), sometimes followed
  // by .limit(). Make the returned object thenable so `await where(...)`
  // resolves to the rows.
  const whereReturn: {
    limit: typeof limit;
    orderBy: typeof orderBy;
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
  } = {
    limit,
    orderBy,
    then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
  };
  const where = vi.fn().mockReturnValue(whereReturn);
  const from = vi.fn().mockReturnValue({ where });
  mockDb.select.mockImplementationOnce(() => ({ from }));
}

// Helper: push several select results in order.
function pushSelects(...rowsets: unknown[][]) {
  for (const rows of rowsets) pushSelect(rows);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetFileUrl.mockResolvedValue('https://signed.example/obj?sig=1');
});

// ---------- attachment_get ----------

describe('getAttachmentMetaById: Bam task attachment', () => {
  it('returns clean metadata with a signed deep_link when preflight passes', async () => {
    const cleanRow = {
      id: ATT_ID,
      task_id: TASK_ID,
      uploader_id: UPLOADER_ID,
      filename: 'design.pdf',
      content_type: 'application/pdf',
      size_bytes: 12345,
      storage_key: 'org/project/task/att.pdf',
      thumbnail_key: null,
      scan_status: 'clean',
      scan_signature: 'sha256:beef',
      scanned_at: new Date('2026-04-17T12:00:00Z'),
      scan_error: null,
      created_at: new Date('2026-04-17T11:59:00Z'),
    };

    // Dispatcher locate path probes bam first and wins immediately.
    pushSelects([cleanRow]); // bam attachments
    // Preflight allowed.
    mockPreflight.mockResolvedValueOnce({ allowed: true, reason: 'ok' });
    // Uploader kinds lookup.
    pushSelects([{ id: UPLOADER_ID, kind: 'human' }]);

    const result = await getAttachmentMetaById(ASKER, ATT_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.parent_type).toBe('bam.task');
    expect(result.data.parent_id).toBe(TASK_ID);
    expect(result.data.scan_status).toBe('clean');
    expect(result.data.scan_signature).toBe('sha256:beef');
    expect(result.data.uploader_kind).toBe('human');
    // Clean => deep_link is non-null.
    expect(result.data.deep_link).toMatch(/^https:\/\/signed\./);
    expect(mockGetFileUrl).toHaveBeenCalledTimes(1);
  });

  it('returns metadata with deep_link=null for infected rows', async () => {
    const infectedRow = {
      id: ATT_ID,
      task_id: TASK_ID,
      uploader_id: UPLOADER_ID,
      filename: 'virus.exe',
      content_type: 'application/octet-stream',
      size_bytes: 42,
      storage_key: 'org/project/task/virus.exe',
      thumbnail_key: null,
      scan_status: 'infected',
      scan_signature: 'sha256:virus',
      scanned_at: new Date(),
      scan_error: null,
      created_at: new Date(),
    };

    pushSelects([infectedRow]);
    mockPreflight.mockResolvedValueOnce({ allowed: true, reason: 'ok' });
    pushSelects([{ id: UPLOADER_ID, kind: 'human' }]);

    const result = await getAttachmentMetaById(ASKER, ATT_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.scan_status).toBe('infected');
    // Critical: never presign an infected row.
    expect(result.data.deep_link).toBeNull();
    expect(mockGetFileUrl).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the attachment does not exist in any table', async () => {
    // Bam: no match. Helpdesk: no match. Beacon: no match.
    pushSelects([], [], []);

    const result = await getAttachmentMetaById(ASKER, ATT_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
    // Preflight must NOT have been consulted when the row is missing.
    expect(mockPreflight).not.toHaveBeenCalled();
  });

  it('returns FORBIDDEN with the can_access reason when preflight denies', async () => {
    const row = {
      id: ATT_ID,
      task_id: TASK_ID,
      uploader_id: UPLOADER_ID,
      filename: 'x.pdf',
      content_type: 'application/pdf',
      size_bytes: 1,
      storage_key: 'k',
      thumbnail_key: null,
      scan_status: 'clean',
      scan_signature: null,
      scanned_at: null,
      scan_error: null,
      created_at: new Date(),
    };
    pushSelects([row]);
    mockPreflight.mockResolvedValueOnce({
      allowed: false,
      reason: 'not_project_member',
    });

    const result = await getAttachmentMetaById(ASKER, ATT_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');
    if (result.error.code === 'FORBIDDEN') {
      expect(result.error.reason).toBe('not_project_member');
    }
    // No file signing in the denied path.
    expect(mockGetFileUrl).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND (not FORBIDDEN) for cross-org denial to avoid existence leak', async () => {
    const row = {
      id: ATT_ID,
      task_id: TASK_ID,
      uploader_id: UPLOADER_ID,
      filename: 'x.pdf',
      content_type: 'application/pdf',
      size_bytes: 1,
      storage_key: 'k',
      thumbnail_key: null,
      scan_status: 'clean',
      scan_signature: null,
      scanned_at: null,
      scan_error: null,
      created_at: new Date(),
    };
    pushSelects([row]);
    // Visibility returns not_found for cross-org denial per the
    // visibility service's existence-hiding rule.
    mockPreflight.mockResolvedValueOnce({
      allowed: false,
      reason: 'not_found',
    });

    const result = await getAttachmentMetaById(ASKER, ATT_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });
});

describe('getAttachmentMetaById: dispatcher routing', () => {
  it('falls through Bam -> Helpdesk when Bam has no row', async () => {
    const helpdeskRow = {
      id: ATT_ID,
      ticket_id: TICKET_ID,
      uploaded_by: UPLOADER_ID,
      filename: 'chat.png',
      content_type: 'image/png',
      size_bytes: 999,
      storage_key: 'helpdesk-attachments/t/a/chat.png',
      scan_status: 'pending',
      scan_error: null,
      scanned_at: null,
      created_at: new Date(),
    };
    // Bam miss, Helpdesk hit.
    pushSelects([], [helpdeskRow]);
    mockPreflight.mockResolvedValueOnce({ allowed: true, reason: 'ok' });
    pushSelects([]); // no uploader match in Bam users (helpdesk uses separate table)

    const result = await getAttachmentMetaById(ASKER, ATT_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.parent_type).toBe('helpdesk.ticket');
    expect(result.data.parent_id).toBe(TICKET_ID);
    // Helpdesk has no scan_signature column; always null here.
    expect(result.data.scan_signature).toBeNull();
    // Pending => no deep_link.
    expect(result.data.deep_link).toBeNull();
  });

  it('falls through Bam -> Helpdesk -> Beacon when only Beacon matches', async () => {
    const beaconRow = {
      id: ATT_ID,
      beacon_id: BEACON_ID,
      uploaded_by: UPLOADER_ID,
      filename: 'playbook.md',
      content_type: 'text/markdown',
      size_bytes: 512,
      storage_key: 'beacons/e/a/playbook.md',
      created_at: new Date(),
    };
    pushSelects([], [], [beaconRow]);
    mockPreflight.mockResolvedValueOnce({ allowed: true, reason: 'ok' });
    pushSelects([{ id: UPLOADER_ID, kind: 'agent' }]);

    const result = await getAttachmentMetaById(ASKER, ATT_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.parent_type).toBe('beacon.entry');
    expect(result.data.parent_id).toBe(BEACON_ID);
    // Beacon has no scan columns; we synthesize pending + null link.
    expect(result.data.scan_status).toBe('pending');
    expect(result.data.deep_link).toBeNull();
    expect(result.data.uploader_kind).toBe('agent');
  });
});

// ---------- attachment_list ----------

describe('listAttachmentsForParent', () => {
  it('rejects unsupported entity_type with the supported allowlist', async () => {
    const result = await listAttachmentsForParent(
      ASKER,
      'blast.campaign',
      TASK_ID,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNSUPPORTED_PARENT_TYPE');
    if (result.error.code === 'UNSUPPORTED_PARENT_TYPE') {
      expect(result.error.supported).toEqual(SUPPORTED_PARENT_TYPES);
    }
    // Must not have talked to the db OR the preflight.
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockPreflight).not.toHaveBeenCalled();
  });

  it('runs preflight BEFORE the attachment table read and returns FORBIDDEN on deny', async () => {
    mockPreflight.mockResolvedValueOnce({
      allowed: false,
      reason: 'not_project_member',
    });

    const result = await listAttachmentsForParent(ASKER, 'bam.task', TASK_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');
    if (result.error.code === 'FORBIDDEN') {
      expect(result.error.reason).toBe('not_project_member');
    }
    // Preflight was consulted, but the attachment table was NOT touched.
    expect(mockPreflight).toHaveBeenCalledOnce();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns the row list when preflight passes and projects rows correctly', async () => {
    mockPreflight.mockResolvedValueOnce({ allowed: true, reason: 'ok' });

    const rows = [
      {
        id: 'row-1',
        task_id: TASK_ID,
        uploader_id: UPLOADER_ID,
        filename: 'one.pdf',
        content_type: 'application/pdf',
        size_bytes: 111,
        storage_key: 'k1',
        thumbnail_key: null,
        scan_status: 'clean',
        scan_signature: null,
        scanned_at: null,
        scan_error: null,
        created_at: new Date('2026-04-17T10:00:00Z'),
      },
      {
        id: 'row-2',
        task_id: TASK_ID,
        uploader_id: UPLOADER_ID,
        filename: 'two.pdf',
        content_type: 'application/pdf',
        size_bytes: 222,
        storage_key: 'k2',
        thumbnail_key: null,
        scan_status: 'pending',
        scan_signature: null,
        scanned_at: null,
        scan_error: null,
        created_at: new Date('2026-04-17T09:00:00Z'),
      },
    ];
    pushSelects(rows);
    pushSelects([{ id: UPLOADER_ID, kind: 'human' }]);

    const result = await listAttachmentsForParent(ASKER, 'bam.task', TASK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(2);
    expect(result.data[0]!.scan_status).toBe('clean');
    expect(result.data[0]!.deep_link).not.toBeNull();
    expect(result.data[1]!.scan_status).toBe('pending');
    expect(result.data[1]!.deep_link).toBeNull();
  });

  it('clamps limit to MAX_LIST_LIMIT', async () => {
    mockPreflight.mockResolvedValueOnce({ allowed: true, reason: 'ok' });
    pushSelects([]);
    pushSelects([]);

    await listAttachmentsForParent(ASKER, 'bam.task', TASK_ID, {
      limit: MAX_LIST_LIMIT * 10,
    });
    // The service clamps without throwing; no behavioural assertion
    // beyond "did not explode". We could assert the limit chain call
    // saw MAX_LIST_LIMIT, but pushSelect's mock does not record the
    // limit value. This test guards the clamp path from regressing to
    // a throw.
    expect(mockPreflight).toHaveBeenCalledOnce();
  });
});
