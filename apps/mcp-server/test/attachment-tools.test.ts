import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../src/middleware/api-client.js';
import { registerAttachmentTools } from '../src/tools/attachment-tools.js';

/**
 * Tests for attachment_get and attachment_list MCP tools
 * (AGENTIC_TODO §17 Wave 4).
 *
 * Coverage spec:
 *  - attachment_get for a clean Bam attachment returns metadata plus a
 *    signed deep_link.
 *  - attachment_get for an infected row returns metadata with deep_link=null.
 *  - attachment_list on a bam.task the caller cannot access surfaces the
 *    can_access reason (pass-through).
 *  - attachment_get for an unknown upload_id surfaces the 404.
 *  - attachment_list with an unsupported entity_type returns
 *    UNSUPPORTED_PARENT_TYPE with the supported allowlist.
 *  - scan_status filter is forwarded on the query string.
 *
 * The tools are a thin wrapper over HTTP; we mock fetch and assert the
 * tool's shape + forwarded parameters. End-to-end visibility enforcement
 * is tested at the Bam-api layer (attachment-meta service unit tests live
 * there, not here).
 */

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const logger = pino({ level: 'silent' });

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

interface RegisteredTool {
  name: string;
  description: string;
  schema: unknown;
  handler: ToolHandler;
}

function createMockServer(): { server: McpServer; tools: Map<string, RegisteredTool> } {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    tool: (
      name: string,
      description: string,
      schema: unknown,
      handler: ToolHandler,
    ) => {
      tools.set(name, { name, description, schema, handler });
    },
  } as unknown as McpServer;
  return { server, tools };
}

function mockApiOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

function mockApiError(status: number, data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => data,
  });
}

const TASK_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ATTACH_UUID = '660e8400-e29b-41d4-a716-446655440001';
const TICKET_UUID = '770e8400-e29b-41d4-a716-446655440002';
const USER_UUID = '880e8400-e29b-41d4-a716-446655440003';

describe('attachment MCP tools', () => {
  let tools: Map<string, RegisteredTool>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new ApiClient('http://localhost:4000', 'test-token', logger);
    const mock = createMockServer();
    tools = mock.tools;
    registerAttachmentTools(mock.server, api);
  });

  function getTool(name: string): RegisteredTool {
    const t = tools.get(name);
    if (!t) throw new Error(`Tool "${name}" not registered`);
    return t;
  }

  // ---- tool registration ----

  it('registers attachment_get and attachment_list', () => {
    expect(tools.has('attachment_get')).toBe(true);
    expect(tools.has('attachment_list')).toBe(true);
    expect(tools.get('attachment_get')!.description).toMatch(/federated/i);
    expect(tools.get('attachment_list')!.description).toMatch(/attachment/i);
  });

  // ---- attachment_get happy path ----

  it('attachment_get returns clean-scan metadata with a deep_link', async () => {
    const signedUrl = 'https://minio.example/bucket/object?signed=1';
    mockApiOk({
      data: {
        id: ATTACH_UUID,
        parent_type: 'bam.task',
        parent_id: TASK_UUID,
        filename: 'design.pdf',
        mime: 'application/pdf',
        size: 123456,
        scan_status: 'clean',
        scan_signature: 'sha256:deadbeef',
        scanned_at: '2026-04-17T12:00:00.000Z',
        scan_error: null,
        uploader_id: USER_UUID,
        uploader_kind: 'human',
        uploaded_at: '2026-04-17T11:59:00.000Z',
        deep_link: signedUrl,
      },
    });

    const result = await getTool('attachment_get').handler({ upload_id: ATTACH_UUID });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.data.scan_status).toBe('clean');
    expect(parsed.data.deep_link).toBe(signedUrl);

    const call = mockFetch.mock.calls[0]!;
    expect(call[0]).toContain(`/v1/attachments/${ATTACH_UUID}`);
    expect(call[1].method).toBe('GET');
  });

  // ---- attachment_get infected row ----

  it('attachment_get surfaces metadata with deep_link=null for infected rows', async () => {
    mockApiOk({
      data: {
        id: ATTACH_UUID,
        parent_type: 'bam.task',
        parent_id: TASK_UUID,
        filename: 'malware.exe',
        mime: 'application/octet-stream',
        size: 42,
        scan_status: 'infected',
        scan_signature: 'sha256:virusvirus',
        scanned_at: '2026-04-17T12:05:00.000Z',
        scan_error: null,
        uploader_id: USER_UUID,
        uploader_kind: 'human',
        uploaded_at: '2026-04-17T12:00:00.000Z',
        deep_link: null,
      },
    });

    const result = await getTool('attachment_get').handler({ upload_id: ATTACH_UUID });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.data.scan_status).toBe('infected');
    // CRITICAL: infected rows must never hand back a download link.
    expect(parsed.data.deep_link).toBeNull();
  });

  // ---- attachment_get not found ----

  it('attachment_get surfaces 404 as isError', async () => {
    mockApiError(404, {
      error: {
        code: 'NOT_FOUND',
        message: 'Attachment not found',
      },
    });

    const result = await getTool('attachment_get').handler({
      upload_id: ATTACH_UUID,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('NOT_FOUND');
  });

  // ---- attachment_get forbidden ----

  it('attachment_get surfaces 403 FORBIDDEN for visibility denials', async () => {
    mockApiError(403, {
      error: {
        code: 'FORBIDDEN',
        message: 'Access to this attachment is denied',
        details: [{ field: 'reason', issue: 'not_project_member' }],
      },
    });

    const result = await getTool('attachment_get').handler({
      upload_id: ATTACH_UUID,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('FORBIDDEN');
    // The reason is carried in the error details array.
    expect(result.content[0]!.text).toContain('not_project_member');
  });

  // ---- attachment_list happy path ----

  it('attachment_list forwards entity_type and entity_id', async () => {
    mockApiOk({
      data: [
        {
          id: ATTACH_UUID,
          parent_type: 'bam.task',
          parent_id: TASK_UUID,
          filename: 'a.pdf',
          mime: 'application/pdf',
          size: 100,
          scan_status: 'clean',
          scan_signature: null,
          scanned_at: null,
          scan_error: null,
          uploader_id: USER_UUID,
          uploader_kind: 'human',
          uploaded_at: '2026-04-17T11:59:00.000Z',
          deep_link: 'https://signed.example/one',
        },
      ],
      meta: {
        entity_type: 'bam.task',
        entity_id: TASK_UUID,
        limit: 50,
        scan_status: null,
        count: 1,
      },
    });

    const result = await getTool('attachment_list').handler({
      entity_type: 'bam.task',
      entity_id: TASK_UUID,
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].scan_status).toBe('clean');

    const call = mockFetch.mock.calls[0]!;
    expect(call[0]).toContain('/v1/attachments?');
    expect(call[0]).toContain('entity_type=bam.task');
    expect(call[0]).toContain(`entity_id=${TASK_UUID}`);
  });

  // ---- attachment_list forbidden ----

  it('attachment_list surfaces 403 with the can_access reason', async () => {
    mockApiError(403, {
      error: {
        code: 'FORBIDDEN',
        message: 'Access to this entity is denied',
        details: [{ field: 'reason', issue: 'not_project_member' }],
      },
    });

    const result = await getTool('attachment_list').handler({
      entity_type: 'bam.task',
      entity_id: TASK_UUID,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('FORBIDDEN');
    expect(result.content[0]!.text).toContain('not_project_member');
  });

  // ---- attachment_list unsupported parent ----

  it('attachment_list surfaces UNSUPPORTED_PARENT_TYPE with the allowlist', async () => {
    mockApiError(400, {
      error: {
        code: 'UNSUPPORTED_PARENT_TYPE',
        message: "entity_type 'blast.campaign' is not a supported attachment parent.",
        supported_entity_types: ['bam.task', 'helpdesk.ticket', 'beacon.entry'],
      },
    });

    const result = await getTool('attachment_list').handler({
      entity_type: 'blast.campaign',
      entity_id: TASK_UUID,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('UNSUPPORTED_PARENT_TYPE');
    expect(result.content[0]!.text).toContain('bam.task');
    expect(result.content[0]!.text).toContain('helpdesk.ticket');
    expect(result.content[0]!.text).toContain('beacon.entry');
  });

  // ---- attachment_list scan_status filter ----

  it('attachment_list forwards scan_status=infected on the query string', async () => {
    mockApiOk({
      data: [],
      meta: {
        entity_type: 'helpdesk.ticket',
        entity_id: TICKET_UUID,
        limit: 50,
        scan_status: 'infected',
        count: 0,
      },
    });

    const result = await getTool('attachment_list').handler({
      entity_type: 'helpdesk.ticket',
      entity_id: TICKET_UUID,
      scan_status: 'infected',
    });

    expect(result.isError).toBeUndefined();
    const call = mockFetch.mock.calls[0]!;
    expect(call[0]).toContain('scan_status=infected');
    expect(call[0]).toContain(`entity_id=${TICKET_UUID}`);
  });

  // ---- attachment_list limit forwarded ----

  it('attachment_list forwards numeric limit', async () => {
    mockApiOk({
      data: [],
      meta: {
        entity_type: 'bam.task',
        entity_id: TASK_UUID,
        limit: 10,
        scan_status: null,
        count: 0,
      },
    });

    await getTool('attachment_list').handler({
      entity_type: 'bam.task',
      entity_id: TASK_UUID,
      limit: 10,
    });

    const call = mockFetch.mock.calls[0]!;
    expect(call[0]).toContain('limit=10');
  });
});
