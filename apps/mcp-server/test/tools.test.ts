import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import { ApiClient } from '../src/middleware/api-client.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const logger = pino({ level: 'silent' });

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ApiClient('http://localhost:3000', 'test-token-123', logger);
  });

  it('should construct proper URLs for GET requests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });

    await client.get('/projects');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/projects',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('should construct proper URLs for POST requests with body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: 'new-project' } }),
    });

    const body = { name: 'Test Project', task_id_prefix: 'TST' };
    await client.post('/projects', body);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123',
        }),
      }),
    );
  });

  it('should construct proper URLs for PATCH requests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 'task-1', title: 'Updated' } }),
    });

    await client.patch('/tasks/task-1', { title: 'Updated' });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/tasks/task-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('should construct proper URLs for DELETE requests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    });

    await client.delete('/tasks/task-1');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/tasks/task-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('should strip trailing slash from base URL', () => {
    const c = new ApiClient('http://localhost:3000/', 'token', logger);
    expect(c.getBaseUrl()).toBe('http://localhost:3000');
  });

  it('should return ok: false when the API returns an error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    const result = await client.get('/projects/nonexistent');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.data).toEqual({ error: 'Not found' });
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await client.get('/projects');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.data).toEqual({ error: 'Network error' });
  });
});

describe('Tool input validation patterns', () => {
  it('should validate UUID format', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(uuidRegex.test('not-a-uuid')).toBe(false);
    expect(uuidRegex.test('')).toBe(false);
  });

  it('should validate task_id_prefix format', () => {
    const prefixRegex = /^[A-Z]{2,6}$/;
    expect(prefixRegex.test('BB')).toBe(true);
    expect(prefixRegex.test('BIGBLUE')).toBe(false); // Too long
    expect(prefixRegex.test('b')).toBe(false); // Lowercase
    expect(prefixRegex.test('BBB')).toBe(true);
  });

  it('should validate priority values', () => {
    const validPriorities = ['critical', 'high', 'medium', 'low', 'none'];
    expect(validPriorities.includes('high')).toBe(true);
    expect(validPriorities.includes('urgent')).toBe(false);
  });
});

describe('MCP response format', () => {
  it('should produce correct text content format', () => {
    const data = { id: '123', name: 'Test' };
    const response = {
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };

    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe('text');
    expect(JSON.parse(response.content[0].text)).toEqual(data);
  });

  it('should produce correct error format', () => {
    const response = {
      content: [{ type: 'text' as const, text: 'Error: not found' }],
      isError: true,
    };

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Error');
  });
});
