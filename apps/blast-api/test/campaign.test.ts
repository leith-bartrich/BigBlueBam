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
    PORT: 4010,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    BBB_API_INTERNAL_URL: 'http://api:4000',
    BOND_API_INTERNAL_URL: 'http://bond-api:4009',
    TRACKING_BASE_URL: 'http://localhost',
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
const CAMPAIGN_ID = '00000000-0000-0000-0000-000000000100';
const TEMPLATE_ID = '00000000-0000-0000-0000-000000000200';
const SEGMENT_ID = '00000000-0000-0000-0000-000000000300';

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    organization_id: ORG_ID,
    name: 'April Newsletter',
    template_id: TEMPLATE_ID,
    subject: 'Check out what is new!',
    html_body:
      '<h1>Hello</h1><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>' +
      '<p>Acme Corp, 123 Main St, Springfield, IL 62701, USA</p>',
    plain_text_body:
      'Hello\n\nUnsubscribe: {{unsubscribe_url}}\n\n' +
      'Acme Corp, 123 Main St, Springfield, IL 62701, USA',
    segment_id: SEGMENT_ID,
    recipient_count: 500,
    from_name: 'Acme Corp',
    from_email: 'news@acme.com',
    reply_to_email: null,
    status: 'draft',
    scheduled_at: null,
    sent_at: null,
    completed_at: null,
    total_sent: 0,
    total_delivered: 0,
    total_bounced: 0,
    total_opened: 0,
    total_clicked: 0,
    total_unsubscribed: 0,
    total_complained: 0,
    created_by: USER_ID,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// listCampaigns
// ---------------------------------------------------------------------------

describe('listCampaigns', () => {
  let listCampaigns: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/campaign.service.js');
    listCampaigns = mod.listCampaigns;
  });

  it('should return paginated campaign list', async () => {
    const c1 = makeCampaign({ id: 'c-1' });
    mockSelect.mockReturnValue(chainable([c1]));

    const result = await listCampaigns({ organization_id: ORG_ID });
    expect(result.data).toHaveLength(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('should filter by status', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listCampaigns({ organization_id: ORG_ID, status: 'sent' });
    expect(result.data).toEqual([]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('should cap limit to 100', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listCampaigns({ organization_id: ORG_ID, limit: 500 });
    expect(result.limit).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getCampaign
// ---------------------------------------------------------------------------

describe('getCampaign', () => {
  let getCampaign: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/campaign.service.js');
    getCampaign = mod.getCampaign;
  });

  it('should return campaign by ID', async () => {
    const campaign = makeCampaign();
    mockSelect.mockReturnValue(chainable([campaign]));

    const result = await getCampaign(CAMPAIGN_ID, ORG_ID);
    expect(result.id).toBe(CAMPAIGN_ID);
    expect(result.name).toBe('April Newsletter');
  });

  it('should throw NOT_FOUND when campaign does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(getCampaign('nonexistent', ORG_ID)).rejects.toThrow('Campaign not found');
  });
});

// ---------------------------------------------------------------------------
// createCampaign
// ---------------------------------------------------------------------------

describe('createCampaign', () => {
  let createCampaign: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/campaign.service.js');
    createCampaign = mod.createCampaign;
  });

  it('should create a draft campaign', async () => {
    const campaign = makeCampaign();
    mockInsert.mockReturnValue(chainable([campaign]));

    const result = await createCampaign(
      {
        name: 'April Newsletter',
        subject: 'Check out what is new!',
        html_body: '<h1>Hello</h1>',
      },
      ORG_ID,
      USER_ID,
    );

    expect(result).toBeDefined();
    expect(result.name).toBe('April Newsletter');
    expect(mockInsert).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateCampaign
// ---------------------------------------------------------------------------

describe('updateCampaign', () => {
  let updateCampaign: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/campaign.service.js');
    updateCampaign = mod.updateCampaign;
  });

  it('should update a draft campaign', async () => {
    const existing = makeCampaign({ status: 'draft' });
    const updated = makeCampaign({ name: 'Updated Newsletter' });

    mockSelect.mockReturnValue(chainable([existing]));
    mockUpdate.mockReturnValue(chainable([updated]));

    const result = await updateCampaign(CAMPAIGN_ID, ORG_ID, { name: 'Updated Newsletter' });
    expect(result.name).toBe('Updated Newsletter');
  });

  it('should reject update on sent campaign', async () => {
    const existing = makeCampaign({ status: 'sent' });
    mockSelect.mockReturnValue(chainable([existing]));

    await expect(
      updateCampaign(CAMPAIGN_ID, ORG_ID, { name: 'Too Late' }),
    ).rejects.toThrow('Can only update campaigns in draft or scheduled status');
  });
});

// ---------------------------------------------------------------------------
// deleteCampaign
// ---------------------------------------------------------------------------

describe('deleteCampaign', () => {
  let deleteCampaign: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/campaign.service.js');
    deleteCampaign = mod.deleteCampaign;
  });

  it('should delete a draft campaign', async () => {
    const existing = makeCampaign({ status: 'draft' });
    mockSelect.mockReturnValue(chainable([existing]));
    mockDelete.mockReturnValue(chainable([{ id: CAMPAIGN_ID }]));

    const result = await deleteCampaign(CAMPAIGN_ID, ORG_ID);
    expect(result.id).toBe(CAMPAIGN_ID);
  });

  it('should reject delete on non-draft campaign', async () => {
    const existing = makeCampaign({ status: 'sent' });
    mockSelect.mockReturnValue(chainable([existing]));

    await expect(deleteCampaign(CAMPAIGN_ID, ORG_ID)).rejects.toThrow(
      'Can only delete campaigns in draft status',
    );
  });
});

// ---------------------------------------------------------------------------
// scheduleCampaign
// ---------------------------------------------------------------------------

describe('scheduleCampaign', () => {
  let scheduleCampaign: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/campaign.service.js');
    scheduleCampaign = mod.scheduleCampaign;
  });

  it('should schedule a draft campaign', async () => {
    const existing = makeCampaign({ status: 'draft' });
    const scheduled = makeCampaign({ status: 'scheduled' });
    mockSelect.mockReturnValue(chainable([existing]));
    mockUpdate.mockReturnValue(chainable([scheduled]));

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const result = await scheduleCampaign(CAMPAIGN_ID, ORG_ID, futureDate);
    expect(result.status).toBe('scheduled');
  });

  it('should reject scheduling in the past', async () => {
    const existing = makeCampaign({ status: 'draft' });
    mockSelect.mockReturnValue(chainable([existing]));

    const pastDate = new Date('2020-01-01').toISOString();
    await expect(scheduleCampaign(CAMPAIGN_ID, ORG_ID, pastDate)).rejects.toThrow(
      'Scheduled time must be in the future',
    );
  });
});

// ---------------------------------------------------------------------------
// Campaign status transitions
// ---------------------------------------------------------------------------

describe('campaign status transitions', () => {
  let pauseCampaign: Function;
  let cancelCampaign: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/campaign.service.js');
    pauseCampaign = mod.pauseCampaign;
    cancelCampaign = mod.cancelCampaign;
  });

  it('should only pause a sending campaign', async () => {
    const existing = makeCampaign({ status: 'draft' });
    mockSelect.mockReturnValue(chainable([existing]));

    await expect(pauseCampaign(CAMPAIGN_ID, ORG_ID)).rejects.toThrow(
      'Can only pause campaigns that are currently sending',
    );
  });

  it('should cancel a scheduled campaign', async () => {
    const existing = makeCampaign({ status: 'scheduled' });
    const cancelled = makeCampaign({ status: 'cancelled' });
    mockSelect.mockReturnValue(chainable([existing]));
    mockUpdate.mockReturnValue(chainable([cancelled]));

    const result = await cancelCampaign(CAMPAIGN_ID, ORG_ID);
    expect(result.status).toBe('cancelled');
  });
});
