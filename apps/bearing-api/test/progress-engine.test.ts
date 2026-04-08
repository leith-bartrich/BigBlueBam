import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the database module
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockExecute = vi.fn();

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockSelect,
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  obj.from = vi.fn().mockReturnValue(obj);
  obj.where = vi.fn().mockReturnValue(obj);
  obj.orderBy = vi.fn().mockReturnValue(obj);
  obj.innerJoin = vi.fn().mockReturnValue(obj);
  return obj;
}

// ---------------------------------------------------------------------------
// computeKrProgress (pure function)
// ---------------------------------------------------------------------------

describe('computeKrProgress', () => {
  let computeKrProgress: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/progress-engine.js');
    computeKrProgress = mod.computeKrProgress;
  });

  it('should compute progress for increase direction: (current - start) / (target - start)', () => {
    const result = computeKrProgress({
      start_value: '0',
      current_value: '50',
      target_value: '100',
      direction: 'increase',
      progress_mode: 'manual',
    });

    expect(result).toBe(50);
  });

  it('should compute 100% when target reached', () => {
    const result = computeKrProgress({
      start_value: '0',
      current_value: '100',
      target_value: '100',
      direction: 'increase',
      progress_mode: 'manual',
    });

    expect(result).toBe(100);
  });

  it('should compute 0% when at start', () => {
    const result = computeKrProgress({
      start_value: '0',
      current_value: '0',
      target_value: '100',
      direction: 'increase',
      progress_mode: 'manual',
    });

    expect(result).toBe(0);
  });

  it('should handle decrease direction (inverted)', () => {
    // Decrease: from start 100 to target 0, currently at 50 => 50% progress
    const result = computeKrProgress({
      start_value: '100',
      current_value: '50',
      target_value: '0',
      direction: 'decrease',
      progress_mode: 'manual',
    });

    expect(result).toBe(50);
  });

  it('should handle decrease direction at target', () => {
    const result = computeKrProgress({
      start_value: '100',
      current_value: '0',
      target_value: '0',
      direction: 'decrease',
      progress_mode: 'manual',
    });

    expect(result).toBe(100);
  });

  it('should clamp progress to 0 (no negative progress)', () => {
    // current below start in increase mode
    const result = computeKrProgress({
      start_value: '50',
      current_value: '30',
      target_value: '100',
      direction: 'increase',
      progress_mode: 'manual',
    });

    expect(result).toBe(0);
  });

  it('should clamp progress to 100 (no overflow)', () => {
    // current above target in increase mode
    const result = computeKrProgress({
      start_value: '0',
      current_value: '150',
      target_value: '100',
      direction: 'increase',
      progress_mode: 'manual',
    });

    expect(result).toBe(100);
  });

  it('should return 100 when range is zero in increase direction', () => {
    const result = computeKrProgress({
      start_value: '50',
      current_value: '50',
      target_value: '50',
      direction: 'increase',
      progress_mode: 'manual',
    });

    expect(result).toBe(100);
  });

  it('should return 100 when range is zero in decrease direction', () => {
    const result = computeKrProgress({
      start_value: '50',
      current_value: '50',
      target_value: '50',
      direction: 'decrease',
      progress_mode: 'manual',
    });

    expect(result).toBe(100);
  });

  it('should return 0 for linked progress mode (computed separately)', () => {
    const result = computeKrProgress({
      start_value: '0',
      current_value: '50',
      target_value: '100',
      direction: 'increase',
      progress_mode: 'linked',
    });

    expect(result).toBe(0);
  });

  it('should handle non-zero start value correctly', () => {
    // start=20, current=60, target=100 => (60-20)/(100-20) = 40/80 = 50%
    const result = computeKrProgress({
      start_value: '20',
      current_value: '60',
      target_value: '100',
      direction: 'increase',
      progress_mode: 'manual',
    });

    expect(result).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// computeGoalProgress (async, uses DB)
// ---------------------------------------------------------------------------

describe('computeGoalProgress', () => {
  let computeGoalProgress: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/progress-engine.js');
    computeGoalProgress = mod.computeGoalProgress;
  });

  it('should return average of KR progress values', async () => {
    mockSelect.mockReturnValue(chainable([{ avg_progress: '75.00' }]));

    const result = await computeGoalProgress('goal-1');

    expect(result).toBe(75);
  });

  it('should return 0 when no key results exist', async () => {
    mockSelect.mockReturnValue(chainable([{ avg_progress: null }]));

    const result = await computeGoalProgress('goal-1');

    expect(result).toBe(0);
  });

  it('should return 0 when result set is empty', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await computeGoalProgress('goal-1');

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeGoalStatus (async, uses DB for period lookup)
// ---------------------------------------------------------------------------

describe('computeGoalStatus', () => {
  let computeGoalStatus: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/progress-engine.js');
    computeGoalStatus = mod.computeGoalStatus;
  });

  it('should respect status_override and return existing status', async () => {
    const result = await computeGoalStatus({
      id: 'goal-1',
      period_id: 'period-1',
      progress: '50',
      status_override: true,
      status: 'at_risk',
    });

    expect(result).toBe('at_risk');
    // Should not query DB for period
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('should compute auto-status when override is false', async () => {
    mockSelect.mockReturnValue(chainable([{
      id: 'period-1',
      starts_at: '2026-01-01',
      ends_at: '2026-12-31',
      status: 'active',
    }]));

    const result = await computeGoalStatus({
      id: 'goal-1',
      period_id: 'period-1',
      progress: '100',
      status_override: false,
      status: 'on_track',
    });

    expect(result).toBe('achieved');
  });

  it('should return existing status when period not found', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await computeGoalStatus({
      id: 'goal-1',
      period_id: 'period-missing',
      progress: '50',
      status_override: false,
      status: 'on_track',
    });

    expect(result).toBe('on_track');
  });
});
