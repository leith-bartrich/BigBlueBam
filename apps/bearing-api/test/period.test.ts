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
    transaction: vi.fn(),
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
    MCP_INTERNAL_URL: 'http://mcp-server:3001',
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
  return obj;
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const PERIOD_ID = '00000000-0000-0000-0000-000000000010';

function makePeriod(overrides: Record<string, unknown> = {}) {
  return {
    id: PERIOD_ID,
    organization_id: ORG_ID,
    name: 'Q2 2026',
    period_type: 'quarter',
    starts_at: '2026-04-01',
    ends_at: '2026-06-30',
    status: 'planning',
    created_by: USER_ID,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// listPeriods
// ---------------------------------------------------------------------------

describe('listPeriods', () => {
  let listPeriods: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/period.service.js');
    listPeriods = mod.listPeriods;
  });

  it('should return paginated list with cursor-based pagination', async () => {
    const p1 = makePeriod({ id: 'p-1', created_at: new Date('2026-04-01') });
    const p2 = makePeriod({ id: 'p-2', created_at: new Date('2026-04-02') });

    mockSelect.mockReturnValue(chainable([p1, p2]));

    const result = await listPeriods({ orgId: ORG_ID, limit: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.has_more).toBe(true);
    expect(result.meta.next_cursor).toBeDefined();
  });

  it('should filter by status', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listPeriods({ orgId: ORG_ID, status: 'active' });

    expect(result.data).toEqual([]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('should return empty list when no periods match', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listPeriods({ orgId: ORG_ID });

    expect(result.data).toEqual([]);
    expect(result.meta.has_more).toBe(false);
    expect(result.meta.next_cursor).toBeNull();
  });

  it('should cap limit to 100', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listPeriods({ orgId: ORG_ID, limit: 500 });

    expect(result.data).toEqual([]);
    expect(result.meta.has_more).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createPeriod
// ---------------------------------------------------------------------------

describe('createPeriod', () => {
  let createPeriod: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/period.service.js');
    createPeriod = mod.createPeriod;
  });

  it('should create period with valid data', async () => {
    const period = makePeriod();
    mockInsert.mockReturnValue(chainable([period]));

    const result = await createPeriod(
      {
        name: 'Q2 2026',
        period_type: 'quarter',
        starts_at: '2026-04-01',
        ends_at: '2026-06-30',
      },
      USER_ID,
      ORG_ID,
    );

    expect(result).toBeDefined();
    expect(result.name).toBe('Q2 2026');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should reject creating period where ends_at <= starts_at', async () => {
    await expect(
      createPeriod(
        {
          name: 'Bad Period',
          period_type: 'quarter',
          starts_at: '2026-06-30',
          ends_at: '2026-04-01',
        },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrow('starts_at must be before ends_at');
  });

  it('should reject creating period where starts_at equals ends_at', async () => {
    await expect(
      createPeriod(
        {
          name: 'Same Day',
          period_type: 'quarter',
          starts_at: '2026-06-30',
          ends_at: '2026-06-30',
        },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrow('starts_at must be before ends_at');
  });

  it('should default status to planning', async () => {
    const period = makePeriod({ status: 'planning' });
    mockInsert.mockReturnValue(chainable([period]));

    const result = await createPeriod(
      {
        name: 'Q2 2026',
        period_type: 'quarter',
        starts_at: '2026-04-01',
        ends_at: '2026-06-30',
      },
      USER_ID,
      ORG_ID,
    );

    expect(result.status).toBe('planning');
  });
});

// ---------------------------------------------------------------------------
// getPeriod
// ---------------------------------------------------------------------------

describe('getPeriod', () => {
  let getPeriod: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/period.service.js');
    getPeriod = mod.getPeriod;
  });

  it('should return period with summary stats', async () => {
    const period = makePeriod();

    mockSelect.mockReturnValue(chainable([period]));
    mockExecute.mockResolvedValue([
      { goal_count: 5, avg_progress: '42.50', at_risk_count: 2 },
    ]);

    const result = await getPeriod(PERIOD_ID, ORG_ID);

    expect(result).toBeDefined();
    expect(result!.id).toBe(PERIOD_ID);
    expect(result!.stats.goal_count).toBe(5);
    expect(result!.stats.avg_progress).toBe(42.5);
    expect(result!.stats.at_risk_count).toBe(2);
  });

  it('should return null when period not found', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await getPeriod('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('should return zero stats when no goals exist', async () => {
    const period = makePeriod();
    mockSelect.mockReturnValue(chainable([period]));
    mockExecute.mockResolvedValue([]);

    const result = await getPeriod(PERIOD_ID, ORG_ID);

    expect(result).toBeDefined();
    expect(result!.stats.goal_count).toBe(0);
    expect(result!.stats.avg_progress).toBe(0);
    expect(result!.stats.at_risk_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updatePeriod
// ---------------------------------------------------------------------------

describe('updatePeriod', () => {
  let updatePeriod: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/period.service.js');
    updatePeriod = mod.updatePeriod;
  });

  it('should update period metadata', async () => {
    const existing = makePeriod();
    const updated = makePeriod({ name: 'Q2 2026 Updated' });

    // getPeriodById select
    mockSelect.mockReturnValue(chainable([existing]));
    mockUpdate.mockReturnValue(chainable([updated]));

    const result = await updatePeriod(PERIOD_ID, { name: 'Q2 2026 Updated' }, ORG_ID);

    expect(result.name).toBe('Q2 2026 Updated');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('should throw NOT_FOUND when period does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(
      updatePeriod(PERIOD_ID, { name: 'New' }, ORG_ID),
    ).rejects.toThrow('Period not found');
  });

  it('should reject update that makes starts_at >= ends_at', async () => {
    const existing = makePeriod();
    mockSelect.mockReturnValue(chainable([existing]));

    await expect(
      updatePeriod(PERIOD_ID, { starts_at: '2026-12-01' }, ORG_ID),
    ).rejects.toThrow('starts_at must be before ends_at');
  });
});

// ---------------------------------------------------------------------------
// deletePeriod
// ---------------------------------------------------------------------------

describe('deletePeriod', () => {
  let deletePeriod: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/period.service.js');
    deletePeriod = mod.deletePeriod;
  });

  it('should delete period with no goals', async () => {
    const existing = makePeriod();
    mockSelect.mockReturnValue(chainable([existing]));
    mockExecute.mockResolvedValue([{ c: 0 }]);
    mockDelete.mockReturnValue(chainable([]));

    const result = await deletePeriod(PERIOD_ID, ORG_ID);
    expect(result.deleted).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should throw CONFLICT when period has goals', async () => {
    const existing = makePeriod();
    mockSelect.mockReturnValue(chainable([existing]));
    mockExecute.mockResolvedValue([{ c: 3 }]);

    await expect(deletePeriod(PERIOD_ID, ORG_ID)).rejects.toThrow(
      'Cannot delete period with existing goals',
    );
  });

  it('should throw NOT_FOUND when period does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(deletePeriod(PERIOD_ID, ORG_ID)).rejects.toThrow('Period not found');
  });
});

// ---------------------------------------------------------------------------
// activatePeriod
// ---------------------------------------------------------------------------

describe('activatePeriod', () => {
  let activatePeriod: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/period.service.js');
    activatePeriod = mod.activatePeriod;
  });

  it('should activate a planning period', async () => {
    const existing = makePeriod({ status: 'planning' });
    const activated = makePeriod({ status: 'active' });

    mockSelect.mockReturnValue(chainable([existing]));
    mockUpdate.mockReturnValue(chainable([activated]));

    const result = await activatePeriod(PERIOD_ID, ORG_ID);
    expect(result.status).toBe('active');
  });

  it('should throw when already active', async () => {
    const existing = makePeriod({ status: 'active' });
    mockSelect.mockReturnValue(chainable([existing]));

    await expect(activatePeriod(PERIOD_ID, ORG_ID)).rejects.toThrow(
      'Period is already active',
    );
  });

  it('should throw when trying to activate a completed period', async () => {
    const existing = makePeriod({ status: 'completed' });
    mockSelect.mockReturnValue(chainable([existing]));

    await expect(activatePeriod(PERIOD_ID, ORG_ID)).rejects.toThrow(
      'Cannot activate a completed period',
    );
  });

  it('should throw NOT_FOUND when period does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(activatePeriod(PERIOD_ID, ORG_ID)).rejects.toThrow('Period not found');
  });
});

// ---------------------------------------------------------------------------
// completePeriod
// ---------------------------------------------------------------------------

describe('completePeriod', () => {
  let completePeriod: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/period.service.js');
    completePeriod = mod.completePeriod;
  });

  it('should complete an active period', async () => {
    const existing = makePeriod({ status: 'active' });
    const completed = makePeriod({ status: 'completed' });

    mockSelect.mockReturnValue(chainable([existing]));
    mockUpdate.mockReturnValue(chainable([completed]));

    const result = await completePeriod(PERIOD_ID, ORG_ID);
    expect(result.status).toBe('completed');
  });

  it('should throw when already completed', async () => {
    const existing = makePeriod({ status: 'completed' });
    mockSelect.mockReturnValue(chainable([existing]));

    await expect(completePeriod(PERIOD_ID, ORG_ID)).rejects.toThrow(
      'Period is already completed',
    );
  });

  it('should throw NOT_FOUND when period does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(completePeriod(PERIOD_ID, ORG_ID)).rejects.toThrow('Period not found');
  });
});

// ---------------------------------------------------------------------------
// BearingError
// ---------------------------------------------------------------------------

describe('BearingError', () => {
  it('should create error with code, message, and status', async () => {
    const { BearingError } = await import('../src/services/period.service.js');
    const error = new BearingError('NOT_FOUND', 'Period not found', 404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Period not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('BearingError');
  });

  it('should default to 400 status code', async () => {
    const { BearingError } = await import('../src/services/period.service.js');
    const error = new BearingError('VALIDATION', 'Bad data');
    expect(error.statusCode).toBe(400);
  });
});
