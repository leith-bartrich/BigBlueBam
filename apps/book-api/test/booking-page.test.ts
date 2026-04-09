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
const PAGE_ID = '00000000-0000-0000-0000-000000000300';

function makeBookingPage(overrides: Record<string, unknown> = {}) {
  return {
    id: PAGE_ID,
    organization_id: ORG_ID,
    owner_user_id: USER_ID,
    slug: 'intro-call',
    title: '30-Minute Intro Call',
    description: 'Book a quick intro call',
    duration_minutes: 30,
    buffer_before_min: 0,
    buffer_after_min: 15,
    max_advance_days: 60,
    min_notice_hours: 4,
    color: '#3b82f6',
    logo_url: null,
    confirmation_message: 'Your meeting has been booked!',
    redirect_url: null,
    auto_create_bond_contact: true,
    auto_create_bam_task: false,
    bam_project_id: null,
    enabled: true,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// listBookingPages
// ---------------------------------------------------------------------------

describe('listBookingPages', () => {
  let listBookingPages: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/booking-page.service.js');
    listBookingPages = mod.listBookingPages;
  });

  it('should return booking pages for user', async () => {
    const page = makeBookingPage();
    mockSelect.mockReturnValue(chainable([page]));

    const result = await listBookingPages(ORG_ID, USER_ID);
    expect(result.data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getBookingPage
// ---------------------------------------------------------------------------

describe('getBookingPage', () => {
  let getBookingPage: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/booking-page.service.js');
    getBookingPage = mod.getBookingPage;
  });

  it('should return booking page by ID', async () => {
    const page = makeBookingPage();
    mockSelect.mockReturnValue(chainable([page]));

    const result = await getBookingPage(PAGE_ID, ORG_ID);
    expect(result.id).toBe(PAGE_ID);
    expect(result.slug).toBe('intro-call');
  });

  it('should throw NOT_FOUND when page does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(getBookingPage('nonexistent', ORG_ID)).rejects.toThrow('Booking page not found');
  });
});

// ---------------------------------------------------------------------------
// createBookingPage
// ---------------------------------------------------------------------------

describe('createBookingPage', () => {
  let createBookingPage: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/booking-page.service.js');
    createBookingPage = mod.createBookingPage;
  });

  it('should create a booking page', async () => {
    const page = makeBookingPage();
    mockSelect.mockReturnValue(chainable([])); // no existing slug
    mockInsert.mockReturnValue(chainable([page]));

    const result = await createBookingPage(
      { slug: 'intro-call', title: '30-Minute Intro Call' },
      ORG_ID,
      USER_ID,
    );

    expect(result).toBeDefined();
    expect(result.slug).toBe('intro-call');
  });

  it('should reject duplicate slug', async () => {
    const existing = makeBookingPage();
    mockSelect.mockReturnValue(chainable([existing]));

    await expect(
      createBookingPage(
        { slug: 'intro-call', title: 'Another Page' },
        ORG_ID,
        USER_ID,
      ),
    ).rejects.toThrow('Slug already in use');
  });
});

// ---------------------------------------------------------------------------
// deleteBookingPage
// ---------------------------------------------------------------------------

describe('deleteBookingPage', () => {
  let deleteBookingPage: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/booking-page.service.js');
    deleteBookingPage = mod.deleteBookingPage;
  });

  it('should delete a booking page', async () => {
    const page = makeBookingPage();
    mockSelect.mockReturnValue(chainable([page]));
    mockDelete.mockReturnValue(chainable([{ id: PAGE_ID }]));

    const result = await deleteBookingPage(PAGE_ID, ORG_ID);
    expect(result.id).toBe(PAGE_ID);
  });
});
