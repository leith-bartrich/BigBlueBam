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
  return obj;
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ORG_ID_2 = '00000000-0000-0000-0000-000000000099';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const PIPELINE_ID = '00000000-0000-0000-0000-000000000300';
const STAGE_ID_1 = '00000000-0000-0000-0000-000000000310';
const STAGE_ID_2 = '00000000-0000-0000-0000-000000000311';

function makePipeline(overrides: Record<string, unknown> = {}) {
  return {
    id: PIPELINE_ID,
    organization_id: ORG_ID,
    name: 'Sales Pipeline',
    description: 'Default sales process',
    is_default: true,
    currency: 'USD',
    created_by: USER_ID,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeStage(overrides: Record<string, unknown> = {}) {
  return {
    id: STAGE_ID_1,
    pipeline_id: PIPELINE_ID,
    name: 'Qualification',
    sort_order: 0,
    stage_type: 'active',
    probability_pct: 20,
    rotting_days: 14,
    color: '#3B82F6',
    created_at: new Date('2026-01-01'),
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
// listPipelines
// ---------------------------------------------------------------------------

describe('listPipelines', () => {
  let listPipelines: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/pipeline.service.js');
    listPipelines = mod.listPipelines;
  });

  it('should return all pipelines for the org with stages', async () => {
    const pipeline = makePipeline();
    const stage1 = makeStage({ sort_order: 0 });
    const stage2 = makeStage({ id: STAGE_ID_2, sort_order: 1, name: 'Proposal' });

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) return chainable([pipeline]);
      return chainable([stage1, stage2]);
    });

    const result = await listPipelines(ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0].stages).toHaveLength(2);
    expect(result[0].stages[0].sort_order).toBe(0);
  });

  it('should return empty array when no pipelines exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listPipelines(ORG_ID);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getPipeline
// ---------------------------------------------------------------------------

describe('getPipeline', () => {
  let getPipeline: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/pipeline.service.js');
    getPipeline = mod.getPipeline;
  });

  it('should return pipeline with stages sorted by sort_order', async () => {
    const pipeline = makePipeline();
    const stages = [
      makeStage({ sort_order: 0, name: 'Qualification' }),
      makeStage({ id: STAGE_ID_2, sort_order: 1, name: 'Proposal' }),
    ];

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) return chainable([pipeline]);
      return chainable(stages);
    });

    const result = await getPipeline(PIPELINE_ID, ORG_ID);

    expect(result).toBeDefined();
    expect(result.id).toBe(PIPELINE_ID);
    expect(result.stages).toHaveLength(2);
  });

  it('should return null for cross-org access', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await getPipeline(PIPELINE_ID, ORG_ID_2);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createPipeline
// ---------------------------------------------------------------------------

describe('createPipeline', () => {
  let createPipeline: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/pipeline.service.js');
    createPipeline = mod.createPipeline;
  });

  it('should create pipeline with stages in transaction', async () => {
    const pipeline = makePipeline();
    const stages = [
      makeStage({ sort_order: 0 }),
      makeStage({ id: STAGE_ID_2, sort_order: 1, name: 'Proposal' }),
    ];

    const { txInsert } = setupTransaction();

    let insertCount = 0;
    txInsert.mockImplementation(() => {
      insertCount++;
      if (insertCount === 1) return chainable([pipeline]);
      return chainable(stages);
    });

    const result = await createPipeline(
      {
        name: 'Sales Pipeline',
        stages: [
          { name: 'Qualification', sort_order: 0, stage_type: 'active', probability_pct: 20 },
          { name: 'Proposal', sort_order: 1, stage_type: 'active', probability_pct: 50 },
        ],
      },
      USER_ID,
      ORG_ID,
    );

    expect(result).toBeDefined();
    expect(result.name).toBe('Sales Pipeline');
    expect(txInsert).toHaveBeenCalledTimes(2); // pipeline + stages batch
  });
});

// ---------------------------------------------------------------------------
// updatePipeline
// ---------------------------------------------------------------------------

describe('updatePipeline', () => {
  let updatePipeline: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/pipeline.service.js');
    updatePipeline = mod.updatePipeline;
  });

  it('should update pipeline name and description', async () => {
    const existing = makePipeline();
    const updated = makePipeline({ name: 'Renamed Pipeline', description: 'New desc' });

    mockSelect.mockReturnValue(chainable([existing]));
    mockUpdate.mockReturnValue(chainable([updated]));

    const result = await updatePipeline(
      PIPELINE_ID,
      { name: 'Renamed Pipeline', description: 'New desc' },
      USER_ID,
      ORG_ID,
    );

    expect(result.name).toBe('Renamed Pipeline');
  });

  it('should throw NOT_FOUND when pipeline does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(
      updatePipeline(PIPELINE_ID, { name: 'X' }, USER_ID, ORG_ID),
    ).rejects.toThrow('Pipeline not found');
  });
});

// ---------------------------------------------------------------------------
// reorderStages
// ---------------------------------------------------------------------------

describe('reorderStages', () => {
  let reorderStages: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/pipeline.service.js');
    reorderStages = mod.reorderStages;
  });

  it('should update sort_order for all stages', async () => {
    const pipeline = makePipeline();
    const { txSelect, txUpdate } = setupTransaction();

    txSelect.mockReturnValue(chainable([pipeline]));
    txUpdate.mockReturnValue(chainable([]));

    const result = await reorderStages(
      PIPELINE_ID,
      [
        { id: STAGE_ID_2, sort_order: 0 },
        { id: STAGE_ID_1, sort_order: 1 },
      ],
      ORG_ID,
    );

    expect(result.reordered).toBe(true);
    expect(txUpdate).toHaveBeenCalled();
  });

  it('should throw NOT_FOUND when pipeline does not exist', async () => {
    const { txSelect } = setupTransaction();
    txSelect.mockReturnValue(chainable([]));

    await expect(
      reorderStages(PIPELINE_ID, [{ id: STAGE_ID_1, sort_order: 0 }], ORG_ID),
    ).rejects.toThrow('Pipeline not found');
  });
});

// ---------------------------------------------------------------------------
// deletePipeline
// ---------------------------------------------------------------------------

describe('deletePipeline', () => {
  let deletePipeline: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/pipeline.service.js');
    deletePipeline = mod.deletePipeline;
  });

  it('should delete pipeline when no deals reference it', async () => {
    const existing = makePipeline({ is_default: false });

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) return chainable([existing]); // pipeline lookup
      return chainable([]); // no deals reference this pipeline
    });
    mockDelete.mockReturnValue(chainable([]));

    const result = await deletePipeline(PIPELINE_ID, ORG_ID);
    expect(result.deleted).toBe(true);
  });

  it('should throw when pipeline has existing deals', async () => {
    const existing = makePipeline({ is_default: false });
    const deal = { id: 'deal-1', pipeline_id: PIPELINE_ID };

    let selectCount = 0;
    mockSelect.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) return chainable([existing]);
      return chainable([deal]); // deals reference this pipeline
    });

    await expect(deletePipeline(PIPELINE_ID, ORG_ID)).rejects.toThrow(
      'Cannot delete pipeline with existing deals',
    );
  });
});
