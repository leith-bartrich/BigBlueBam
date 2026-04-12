import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  obj.offset = vi.fn().mockReturnValue(obj);
  return obj;
}

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000003';
const TEMPLATE_ID = '00000000-0000-0000-0000-000000000200';

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEMPLATE_ID,
    organization_id: ORG_ID,
    name: 'Monthly Newsletter',
    description: 'Our monthly update email',
    subject_template: 'Hello {{first_name}}!',
    html_body: '<h1>Hello {{first_name}}</h1>',
    json_design: null,
    plain_text_body: 'Hello {{first_name}}',
    template_type: 'campaign',
    thumbnail_url: null,
    version: 1,
    created_by: USER_ID,
    updated_by: USER_ID,
    created_at: new Date('2026-04-01'),
    updated_at: new Date('2026-04-01'),
    ...overrides,
  };
}

describe('listTemplates', () => {
  let listTemplates: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/template.service.js');
    listTemplates = mod.listTemplates;
  });

  it('should return paginated template list', async () => {
    const t1 = makeTemplate();
    mockSelect.mockReturnValue(chainable([t1]));

    const result = await listTemplates({ organization_id: ORG_ID });
    expect(result.data).toHaveLength(1);
  });

  it('should filter by template_type', async () => {
    mockSelect.mockReturnValue(chainable([]));

    const result = await listTemplates({ organization_id: ORG_ID, template_type: 'drip_step' });
    expect(result.data).toEqual([]);
  });
});

describe('getTemplate', () => {
  let getTemplate: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/template.service.js');
    getTemplate = mod.getTemplate;
  });

  it('should return template by ID', async () => {
    const template = makeTemplate();
    mockSelect.mockReturnValue(chainable([template]));

    const result = await getTemplate(TEMPLATE_ID, ORG_ID);
    expect(result.name).toBe('Monthly Newsletter');
  });

  it('should throw NOT_FOUND when template does not exist', async () => {
    mockSelect.mockReturnValue(chainable([]));

    await expect(getTemplate('nonexistent', ORG_ID)).rejects.toThrow('Template not found');
  });
});

describe('createTemplate', () => {
  let createTemplate: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/template.service.js');
    createTemplate = mod.createTemplate;
  });

  it('should create a template', async () => {
    const template = makeTemplate();
    mockInsert.mockReturnValue(chainable([template]));

    const result = await createTemplate(
      { name: 'Monthly Newsletter', subject_template: 'Hello!', html_body: '<h1>Hi</h1>' },
      ORG_ID,
      USER_ID,
    );

    expect(result.name).toBe('Monthly Newsletter');
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe('updateTemplate', () => {
  let updateTemplate: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/template.service.js');
    updateTemplate = mod.updateTemplate;
  });

  it('should update template fields', async () => {
    const updated = makeTemplate({ name: 'Updated Name', version: 2 });
    mockUpdate.mockReturnValue(chainable([updated]));

    const result = await updateTemplate(TEMPLATE_ID, ORG_ID, { name: 'Updated Name' }, USER_ID);
    expect(result.name).toBe('Updated Name');
    expect(result.version).toBe(2);
  });

  it('should throw NOT_FOUND when template does not exist', async () => {
    mockUpdate.mockReturnValue(chainable([]));

    await expect(
      updateTemplate('nonexistent', ORG_ID, { name: 'X' }, USER_ID),
    ).rejects.toThrow('Template not found');
  });
});

describe('deleteTemplate', () => {
  let deleteTemplate: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/template.service.js');
    deleteTemplate = mod.deleteTemplate;
  });

  it('should delete an existing template', async () => {
    mockDelete.mockReturnValue(chainable([{ id: TEMPLATE_ID }]));

    const result = await deleteTemplate(TEMPLATE_ID, ORG_ID);
    expect(result.id).toBe(TEMPLATE_ID);
  });

  it('should throw NOT_FOUND when template does not exist', async () => {
    mockDelete.mockReturnValue(chainable([]));

    await expect(deleteTemplate('nonexistent', ORG_ID)).rejects.toThrow('Template not found');
  });
});

describe('previewTemplate', () => {
  let previewTemplate: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/services/template.service.js');
    previewTemplate = mod.previewTemplate;
  });

  it('should render merge fields in preview', async () => {
    const template = makeTemplate();
    mockSelect.mockReturnValue(chainable([template]));

    const result = await previewTemplate(TEMPLATE_ID, ORG_ID, { first_name: 'Alice' });
    expect(result.html).toContain('Alice');
    expect(result.subject).toContain('Alice');
  });
});
