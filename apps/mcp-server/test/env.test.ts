import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('MCP Server env validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadEnvFresh() {
    const mod = await import('../src/env.js');
    return mod.loadEnv;
  }

  it('parses valid env correctly', async () => {
    process.env.MCP_PORT = '4000';
    process.env.MCP_TRANSPORT = 'stdio';
    process.env.API_INTERNAL_URL = 'http://localhost:3000';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.MCP_AUTH_REQUIRED = 'true';
    process.env.MCP_RATE_LIMIT_RPM = '60';
    process.env.LOG_LEVEL = 'debug';

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.MCP_PORT).toBe(4000);
    expect(env.MCP_TRANSPORT).toBe('stdio');
    expect(env.API_INTERNAL_URL).toBe('http://localhost:3000');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.MCP_AUTH_REQUIRED).toBe(true);
    expect(env.MCP_RATE_LIMIT_RPM).toBe(60);
    expect(env.LOG_LEVEL).toBe('debug');
  });

  it('defaults MCP_PORT to 3001', async () => {
    delete process.env.MCP_PORT;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.MCP_PORT).toBe(3001);
  });

  it('defaults MCP_TRANSPORT to streamable-http', async () => {
    delete process.env.MCP_TRANSPORT;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.MCP_TRANSPORT).toBe('streamable-http');
  });

  it('fails with invalid transport value', async () => {
    process.env.MCP_TRANSPORT = 'websocket';

    const loadEnv = await loadEnvFresh();

    expect(() => loadEnv()).toThrow('Invalid environment variables');
  });

  it('defaults API_INTERNAL_URL to http://localhost:3000', async () => {
    delete process.env.API_INTERNAL_URL;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.API_INTERNAL_URL).toBe('http://localhost:3000');
  });

  it('defaults REDIS_URL to redis://localhost:6379', async () => {
    delete process.env.REDIS_URL;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('defaults MCP_AUTH_REQUIRED to true', async () => {
    delete process.env.MCP_AUTH_REQUIRED;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.MCP_AUTH_REQUIRED).toBe(true);
  });

  it('defaults MCP_RATE_LIMIT_RPM to 120', async () => {
    delete process.env.MCP_RATE_LIMIT_RPM;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.MCP_RATE_LIMIT_RPM).toBe(120);
  });

  it('defaults LOG_LEVEL to info', async () => {
    delete process.env.LOG_LEVEL;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.LOG_LEVEL).toBe('info');
  });

  it('accepts stdio as valid transport', async () => {
    process.env.MCP_TRANSPORT = 'stdio';

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.MCP_TRANSPORT).toBe('stdio');
  });

  it('accepts streamable-http as valid transport', async () => {
    process.env.MCP_TRANSPORT = 'streamable-http';

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.MCP_TRANSPORT).toBe('streamable-http');
  });
});
