import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
  connection: { end: vi.fn() },
}));

vi.mock('../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 4014,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'a'.repeat(32),
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    BBB_API_INTERNAL_URL: 'http://api:4000',
    PUBLIC_URL: 'http://localhost',
    COOKIE_SECURE: false,
  },
}));

describe('BillError', () => {
  it('should create error with status code and code', async () => {
    const { BillError } = await import('../src/lib/utils.js');
    const error = new BillError(404, 'NOT_FOUND', 'Client not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Client not found');
    expect(error.name).toBe('BillError');
  });
});

describe('formatInvoiceNumber', () => {
  it('should format with zero-padded number', async () => {
    const { formatInvoiceNumber } = await import('../src/lib/utils.js');
    expect(formatInvoiceNumber('INV', 1)).toBe('INV-00001');
    expect(formatInvoiceNumber('INV', 42)).toBe('INV-00042');
    expect(formatInvoiceNumber('INV', 99999)).toBe('INV-99999');
  });
});

describe('centsToDisplay', () => {
  it('should format cents to currency string', async () => {
    const { centsToDisplay } = await import('../src/lib/utils.js');
    expect(centsToDisplay(15000)).toBe('$150.00');
    expect(centsToDisplay(99)).toBe('$0.99');
    expect(centsToDisplay(0)).toBe('$0.00');
  });
});
