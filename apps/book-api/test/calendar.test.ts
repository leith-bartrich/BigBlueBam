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
    PORT: 4012,
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
const CALENDAR_ID = '00000000-0000-0000-0000-000000000100';

function makeCalendar(overrides: Record<string, unknown> = {}) {
  return {
    id: CALENDAR_ID,
    organization_id: ORG_ID,
    owner_user_id: USER_ID,
    project_id: null,
    name: 'My Calendar',
    description: null,
    color: '#3b82f6',
    calendar_type: 'personal',
    is_default: false,
    timezone: 'UTC',
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// listCalendars
// ---------------------------------------------------------------------------

describe('listCalendars', () => {
  let listCalendars: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/calendar.service.js');
    listCalendars = mod.listCalendars;
  });

  it('should return calendars for user', async () => {
    const cal = makeCalendar();
    mockSelect.mockReturnValue(chainable([cal]));

    const result = await listCalendars({ organization_id: ORG_ID, user_id: USER_ID });
    expect(result.data).toHaveLength(1);
    expect(mockSelect).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getCalendar
// ---------------------------------------------------------------------------

describe('getCalendar', () => {
  let getCalendar: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/calendar.service.js');
    getCalendar = mod.getCalendar;
  });

  it('should return calendar by ID', async () => {
    const cal = makeCalendar();
    mockSelect.mockReturnValue(chainable([cal]));

    const result = await getCalendar(CALENDAR_ID, ORG_ID);
    expect(result.id).toBe(CALENDAR_ID);
    expect(result.name).toBe('My Calendar');
  });

  it('should throw NOT_FOUND when calendar does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(getCalendar('nonexistent', ORG_ID)).rejects.toThrow('Calendar not found');
  });
});

// ---------------------------------------------------------------------------
// createCalendar
// ---------------------------------------------------------------------------

describe('createCalendar', () => {
  let createCalendar: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/calendar.service.js');
    createCalendar = mod.createCalendar;
  });

  it('should create a personal calendar', async () => {
    const cal = makeCalendar();
    mockInsert.mockReturnValue(chainable([cal]));

    const result = await createCalendar({ name: 'My Calendar' }, ORG_ID, USER_ID);

    expect(result).toBeDefined();
    expect(result.name).toBe('My Calendar');
    expect(mockInsert).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteCalendar
// ---------------------------------------------------------------------------

describe('deleteCalendar', () => {
  let deleteCalendar: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/calendar.service.js');
    deleteCalendar = mod.deleteCalendar;
  });

  it('should delete a non-default calendar', async () => {
    const cal = makeCalendar({ is_default: false });
    mockSelect.mockReturnValue(chainable([cal]));
    mockDelete.mockReturnValue(chainable([{ id: CALENDAR_ID }]));

    const result = await deleteCalendar(CALENDAR_ID, ORG_ID);
    expect(result.id).toBe(CALENDAR_ID);
  });

  it('should reject deleting default calendar', async () => {
    const cal = makeCalendar({ is_default: true });
    mockSelect.mockReturnValue(chainable([cal]));

    await expect(deleteCalendar(CALENDAR_ID, ORG_ID)).rejects.toThrow(
      'Cannot delete default calendar',
    );
  });
});
