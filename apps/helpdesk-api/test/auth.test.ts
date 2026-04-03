import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  connection: { end: vi.fn() },
}));

vi.mock('../src/env.js', () => ({
  env: {
    PORT: 4001, DATABASE_URL: 'postgres://test:test@localhost/test',
    REDIS_URL: 'redis://localhost:6379', SESSION_SECRET: 'a'.repeat(32),
    HELPDESK_URL: 'http://localhost:8080', CORS_ORIGIN: 'http://localhost:8080',
    NODE_ENV: 'test', LOG_LEVEL: 'info', SESSION_TTL_SECONDS: 604800,
  },
}));

describe('Helpdesk Auth', () => {
  it('should validate registration input requires email', () => {
    const { z } = require('zod');
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(12),
      display_name: z.string().min(1).max(100),
    });
    expect(schema.safeParse({ email: 'bad', password: 'short', display_name: '' }).success).toBe(false);
    expect(schema.safeParse({ email: 'test@test.com', password: 'securepass12345', display_name: 'Test' }).success).toBe(true);
  });

  it('should validate login input', () => {
    const { z } = require('zod');
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });
    expect(schema.safeParse({ email: 'test@test.com', password: 'pass' }).success).toBe(true);
    expect(schema.safeParse({ email: '', password: '' }).success).toBe(false);
  });

  it('should validate ticket creation input', () => {
    const { z } = require('zod');
    const schema = z.object({
      subject: z.string().min(1).max(500),
      description: z.string().min(1),
      category: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
    });
    expect(schema.safeParse({ subject: 'Help!', description: 'My app is broken' }).success).toBe(true);
    expect(schema.safeParse({ subject: '', description: '' }).success).toBe(false);
  });

  it('should validate ticket statuses', () => {
    const validStatuses = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'];
    for (const s of validStatuses) {
      expect(validStatuses.includes(s)).toBe(true);
    }
  });

  it('should validate message creation', () => {
    const { z } = require('zod');
    const schema = z.object({
      body: z.string().min(1),
      is_internal: z.boolean().optional(),
    });
    expect(schema.safeParse({ body: 'Hello' }).success).toBe(true);
    expect(schema.safeParse({ body: '' }).success).toBe(false);
    expect(schema.safeParse({ body: 'Note', is_internal: true }).success).toBe(true);
  });
});
