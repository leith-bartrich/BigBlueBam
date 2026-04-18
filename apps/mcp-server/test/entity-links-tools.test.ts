import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../src/middleware/api-client.js';
import { registerEntityLinksTools } from '../src/tools/entity-links-tools.js';

/**
 * entity_links_* MCP tool tests (AGENTIC_TODO §16 Wave 4).
 *
 * Covers registration + happy path per tool. The API behavior (preflight,
 * cycle detection, idempotency) is exercised in apps/api/test/entity-links.test.ts;
 * these tests verify only the wire shape and error propagation.
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

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';

describe('entity-links MCP tools', () => {
  let tools: Map<string, RegisteredTool>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new ApiClient('http://localhost:4000', 'test-token', logger);
    const mock = createMockServer();
    tools = mock.tools;
    registerEntityLinksTools(mock.server, api);
  });

  function getTool(name: string): RegisteredTool {
    const t = tools.get(name);
    if (!t) throw new Error(`Tool "${name}" not registered`);
    return t;
  }

  // -----------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------
  it('registers entity_links_list, entity_link_create, entity_link_remove', () => {
    expect(tools.has('entity_links_list')).toBe(true);
    expect(tools.has('entity_link_create')).toBe(true);
    expect(tools.has('entity_link_remove')).toBe(true);
  });

  // -----------------------------------------------------------------
  // entity_links_list
  // -----------------------------------------------------------------
  describe('entity_links_list', () => {
    it('GETs /v1/entity-links with the expected query params', async () => {
      mockApiOk({ data: [], filtered_count: 0 });
      const result = await getTool('entity_links_list').handler({
        type: 'bam.task',
        id: UUID_A,
        direction: 'both',
        limit: 25,
      });
      expect(result.isError).toBeUndefined();
      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('/v1/entity-links?');
      expect(url).toContain('type=bam.task');
      expect(url).toContain(`id=${UUID_A}`);
      expect(url).toContain('direction=both');
      expect(url).toContain('limit=25');
    });

    it('passes through filtered_count in the response body', async () => {
      mockApiOk({
        data: [
          {
            id: UUID_B,
            org_id: UUID_A,
            src_type: 'bam.task',
            src_id: UUID_A,
            dst_type: 'bam.task',
            dst_id: UUID_B,
            link_kind: 'related_to',
            created_by: UUID_A,
            created_at: '2026-04-18T00:00:00Z',
            direction: 'outbound',
          },
        ],
        filtered_count: 3,
      });
      const result = await getTool('entity_links_list').handler({
        type: 'bam.task',
        id: UUID_A,
      });
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.filtered_count).toBe(3);
      expect(parsed.data[0].direction).toBe('outbound');
    });

    it('returns isError on API failure', async () => {
      mockApiError(400, { error: { code: 'VALIDATION_ERROR' } });
      const result = await getTool('entity_links_list').handler({
        type: 'bam.task',
        id: UUID_A,
      });
      expect(result.isError).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // entity_link_create
  // -----------------------------------------------------------------
  describe('entity_link_create', () => {
    it('POSTs the full body to /v1/entity-links', async () => {
      mockApiOk({
        data: {
          id: UUID_B,
          org_id: UUID_A,
          src_type: 'bam.task',
          src_id: UUID_A,
          dst_type: 'bam.task',
          dst_id: UUID_B,
          link_kind: 'related_to',
          created_by: UUID_A,
          created_at: '2026-04-18T00:00:00Z',
        },
        created: true,
      });
      const result = await getTool('entity_link_create').handler({
        src_type: 'bam.task',
        src_id: UUID_A,
        dst_type: 'bam.task',
        dst_id: UUID_B,
        link_kind: 'related_to',
      });
      expect(result.isError).toBeUndefined();
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toContain('/v1/entity-links');
      expect(call[1].method).toBe('POST');
      const body = JSON.parse(call[1].body as string);
      expect(body.link_kind).toBe('related_to');
      expect(body.src_id).toBe(UUID_A);
      expect(body.dst_id).toBe(UUID_B);
    });

    it('surfaces 403 from the API as isError with preflight context', async () => {
      mockApiError(403, {
        error: {
          code: 'FORBIDDEN',
          message: 'Caller cannot access src entity',
          preflight: { side: 'src', reason: 'not_project_member' },
        },
      });
      const result = await getTool('entity_link_create').handler({
        src_type: 'bam.task',
        src_id: UUID_A,
        dst_type: 'bam.task',
        dst_id: UUID_B,
        link_kind: 'related_to',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('FORBIDDEN');
    });

    it('surfaces 400 UNSUPPORTED_ENTITY_TYPE as isError', async () => {
      mockApiError(400, {
        error: {
          code: 'UNSUPPORTED_ENTITY_TYPE',
          message: "src_type 'bill.invoice' is not in the supported entity-type allowlist",
        },
      });
      const result = await getTool('entity_link_create').handler({
        src_type: 'bill.invoice',
        src_id: UUID_A,
        dst_type: 'bam.task',
        dst_id: UUID_B,
        link_kind: 'related_to',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('UNSUPPORTED_ENTITY_TYPE');
    });
  });

  // -----------------------------------------------------------------
  // entity_link_remove
  // -----------------------------------------------------------------
  describe('entity_link_remove', () => {
    it('DELETEs /v1/entity-links/:id and returns ok: true', async () => {
      mockApiOk({});
      const result = await getTool('entity_link_remove').handler({ id: UUID_B });
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.ok).toBe(true);
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toContain(`/v1/entity-links/${UUID_B}`);
      expect(call[1].method).toBe('DELETE');
    });

    it('surfaces 404 as isError', async () => {
      mockApiError(404, { error: { code: 'NOT_FOUND', message: 'Link not found' } });
      const result = await getTool('entity_link_remove').handler({ id: UUID_B });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('NOT_FOUND');
    });
  });
});
