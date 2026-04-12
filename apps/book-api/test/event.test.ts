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
  obj.limit = vi.fn().mockReturnValue(obj);
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
const EVENT_ID = '00000000-0000-0000-0000-000000000200';

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    calendar_id: CALENDAR_ID,
    organization_id: ORG_ID,
    title: 'Team Sync',
    description: 'Weekly team meeting',
    location: null,
    meeting_url: null,
    start_at: new Date('2026-04-08T14:00:00Z'),
    end_at: new Date('2026-04-08T15:00:00Z'),
    all_day: false,
    timezone: 'UTC',
    recurrence_rule: null,
    recurrence_end_at: null,
    recurrence_parent_id: null,
    status: 'confirmed',
    visibility: 'busy',
    linked_entity_type: null,
    linked_entity_id: null,
    booking_page_id: null,
    booked_by_name: null,
    booked_by_email: null,
    created_by: USER_ID,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// listEvents
// ---------------------------------------------------------------------------

describe('listEvents', () => {
  let listEvents: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/event.service.js');
    listEvents = mod.listEvents;
  });

  it('should return paginated events', async () => {
    const ev = makeEvent();
    mockSelect.mockReturnValue(chainable([ev]));

    const result = await listEvents({ organization_id: ORG_ID });
    expect(result.data).toHaveLength(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('should cap limit to 500', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listEvents({ organization_id: ORG_ID, limit: 1000 });
    expect(result.limit).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// getEvent
// ---------------------------------------------------------------------------

describe('getEvent', () => {
  let getEvent: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/event.service.js');
    getEvent = mod.getEvent;
  });

  it('should return event with attendees', async () => {
    const ev = makeEvent();
    mockSelect
      .mockReturnValueOnce(chainable([ev]))
      .mockReturnValue(chainable([]));

    const result = await getEvent(EVENT_ID, ORG_ID);
    expect(result.id).toBe(EVENT_ID);
    expect(result.title).toBe('Team Sync');
    expect(result.attendees).toEqual([]);
  });

  it('should throw NOT_FOUND when event does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(getEvent('nonexistent', ORG_ID)).rejects.toThrow('Event not found');
  });
});

// ---------------------------------------------------------------------------
// createEvent
// ---------------------------------------------------------------------------

describe('createEvent', () => {
  let createEvent: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/event.service.js');
    createEvent = mod.createEvent;
  });

  it('should create an event', async () => {
    const ev = makeEvent();
    mockInsert.mockReturnValue(chainable([ev]));

    const result = await createEvent(
      {
        calendar_id: CALENDAR_ID,
        title: 'Team Sync',
        start_at: '2026-04-08T14:00:00Z',
        end_at: '2026-04-08T15:00:00Z',
      },
      ORG_ID,
      USER_ID,
    );

    expect(result).toBeDefined();
    expect(result.title).toBe('Team Sync');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should reject event with end before start', async () => {
    await expect(
      createEvent(
        {
          calendar_id: CALENDAR_ID,
          title: 'Invalid',
          start_at: '2026-04-08T15:00:00Z',
          end_at: '2026-04-08T14:00:00Z',
        },
        ORG_ID,
        USER_ID,
      ),
    ).rejects.toThrow('End time must be after start time');
  });
});

// ---------------------------------------------------------------------------
// deleteEvent (cancel)
// ---------------------------------------------------------------------------

describe('deleteEvent', () => {
  let deleteEvent: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/event.service.js');
    deleteEvent = mod.deleteEvent;
  });

  it('should cancel an event (soft delete)', async () => {
    const ev = makeEvent({ status: 'confirmed' });
    const cancelled = makeEvent({ status: 'cancelled' });

    mockSelect
      .mockReturnValueOnce(chainable([ev]))
      .mockReturnValue(chainable([]));
    mockUpdate.mockReturnValue(chainable([cancelled]));

    const result = await deleteEvent(EVENT_ID, ORG_ID);
    expect(result.status).toBe('cancelled');
  });
});

// ---------------------------------------------------------------------------
// rsvpEvent
// ---------------------------------------------------------------------------

describe('rsvpEvent', () => {
  let rsvpEvent: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/event.service.js');
    rsvpEvent = mod.rsvpEvent;
  });

  it('should throw when user is not attendee', async () => {
    const ev = makeEvent();
    mockSelect
      .mockReturnValueOnce(chainable([ev]))
      .mockReturnValueOnce(chainable([]))
      .mockReturnValue(chainable([]));

    await expect(rsvpEvent(EVENT_ID, ORG_ID, USER_ID, 'accepted')).rejects.toThrow(
      'You are not an attendee of this event',
    );
  });
});
