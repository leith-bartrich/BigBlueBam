import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../src/middleware/api-client.js';
import { registerActivityTools } from '../src/tools/activity-tools.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const logger = pino({ level: 'silent' });

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
    tool: (name: string, description: string, schema: unknown, handler: ToolHandler) => {
      tools.set(name, { name, description, schema, handler });
    },
  } as unknown as McpServer;
  return { server, tools };
}

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const UUID2 = '660e8400-e29b-41d4-a716-446655440001';

describe('activity-tools (§5 Wave 3)', () => {
  let api: ApiClient;
  let tools: Map<string, RegisteredTool>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new ApiClient('http://localhost:4000', 'test-token', logger);
    const mock = createMockServer();
    tools = mock.tools;
    registerActivityTools(mock.server, api);
  });

  function getTool(name: string): RegisteredTool {
    const tool = tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" not registered`);
    return tool;
  }

  describe('activity_query', () => {
    it('forwards entity_type and entity_id as query parameters', async () => {
      mockApiOk({ data: [], meta: { next_cursor: null, has_more: false } });
      await getTool('activity_query').handler({
        entity_type: 'bam.task',
        entity_id: UUID,
      });
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toContain('/v1/activity/unified');
      expect(call[0]).toContain('entity_type=bam.task');
      expect(call[0]).toContain(`entity_id=${UUID}`);
      expect(call[1].method).toBe('GET');
    });

    it('appends since/cursor/limit when provided', async () => {
      mockApiOk({ data: [], meta: { next_cursor: null, has_more: false } });
      await getTool('activity_query').handler({
        entity_type: 'bond.deal',
        entity_id: UUID,
        since: '2026-04-01T00:00:00Z',
        cursor: `2026-04-18T10:00:00.000Z|${UUID2}`,
        limit: 25,
      });
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toContain('since=2026-04-01T00');
      expect(call[0]).toContain('cursor=');
      expect(call[0]).toContain('limit=25');
    });

    it('returns normalized rows on success', async () => {
      mockApiOk({
        data: [
          {
            id: UUID,
            source_app: 'bam',
            entity_type: 'bam.task',
            entity_id: UUID,
            project_id: UUID2,
            organization_id: null,
            actor_id: UUID,
            actor_type: 'human',
            action: 'task.create',
            details: null,
            created_at: new Date().toISOString(),
          },
        ],
        meta: { next_cursor: null, has_more: false },
      });
      const result = await getTool('activity_query').handler({
        entity_type: 'bam.task',
        entity_id: UUID,
      });
      expect(result.isError).toBeUndefined();
      const payload = JSON.parse(result.content[0]!.text);
      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].source_app).toBe('bam');
    });

    it('surfaces API errors through the standard error shape', async () => {
      mockApiError(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' },
      });
      const result = await getTool('activity_query').handler({
        entity_type: 'bam.task',
        entity_id: UUID,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('VALIDATION_ERROR');
    });
  });

  describe('activity_by_actor', () => {
    it('forwards actor_id as a query parameter', async () => {
      mockApiOk({ data: [], meta: { next_cursor: null, has_more: false } });
      await getTool('activity_by_actor').handler({ actor_id: UUID });
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toContain('/v1/activity/unified/by-actor');
      expect(call[0]).toContain(`actor_id=${UUID}`);
      expect(call[1].method).toBe('GET');
    });

    it('appends since/cursor/limit when provided', async () => {
      mockApiOk({ data: [], meta: { next_cursor: null, has_more: false } });
      await getTool('activity_by_actor').handler({
        actor_id: UUID,
        since: '2026-04-01T00:00:00Z',
        limit: 10,
      });
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toContain('since=2026-04-01T00');
      expect(call[0]).toContain('limit=10');
    });

    it('surfaces 404 NOT_FOUND through the error shape', async () => {
      mockApiError(404, {
        error: { code: 'NOT_FOUND', message: 'Actor not found' },
      });
      const result = await getTool('activity_by_actor').handler({ actor_id: UUID });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('NOT_FOUND');
    });
  });

  describe('registration', () => {
    it('registers both tools with descriptions and handlers', () => {
      expect(tools.has('activity_query')).toBe(true);
      expect(tools.has('activity_by_actor')).toBe(true);
      for (const [, tool] of tools) {
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(0);
        expect(typeof tool.handler).toBe('function');
      }
    });
  });
});
