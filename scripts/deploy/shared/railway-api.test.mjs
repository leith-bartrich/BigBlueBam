// railway-api.test.mjs
//
// Unit tests for the Railway GraphQL API client at railway-api.mjs.
// Mocks globalThis.fetch with vi.fn() — no real network calls.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RailwayApiError, RailwayClient } from './railway-api.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a fake Response-like object with the given JSON body and status.
 * Kept as a plain object (not a real Response) so each test can override
 * individual fields (e.g. make json() throw).
 */
function jsonResponse(body, { status = 200, statusText = 'OK' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function errorResponse(status, statusText = 'Error', text = '') {
  return {
    ok: false,
    status,
    statusText,
    json: async () => {
      throw new Error('no body');
    },
    text: async () => text,
  };
}

const VALID_TOKEN = 'test-token-abc';

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// RailwayApiError
// ---------------------------------------------------------------------------

describe('RailwayApiError', () => {
  it('stores kind, errors, status, request correctly and is an Error', () => {
    const err = new RailwayApiError('boom', {
      kind: 'graphql',
      errors: [{ message: 'bad' }],
      status: 500,
      request: { query: 'q', variables: { a: 1 } },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RailwayApiError);
    expect(err.name).toBe('RailwayApiError');
    expect(err.message).toBe('boom');
    expect(err.kind).toBe('graphql');
    expect(err.errors).toEqual([{ message: 'bad' }]);
    expect(err.status).toBe(500);
    expect(err.request).toEqual({ query: 'q', variables: { a: 1 } });
  });

  it('defaults kind to "unknown" and other fields to null', () => {
    const err = new RailwayApiError('oops');
    expect(err.kind).toBe('unknown');
    expect(err.errors).toBeNull();
    expect(err.status).toBeNull();
    expect(err.request).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RailwayClient constructor
// ---------------------------------------------------------------------------

describe('RailwayClient constructor', () => {
  it('throws auth error on missing token', () => {
    try {
      new RailwayClient();
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RailwayApiError);
      expect(err.kind).toBe('auth');
    }
  });

  it('throws auth error on empty-string token', () => {
    expect(() => new RailwayClient('')).toThrow(RailwayApiError);
    try {
      new RailwayClient('');
    } catch (err) {
      expect(err.kind).toBe('auth');
    }
  });

  it('throws auth error on non-string token', () => {
    expect(() => new RailwayClient(12345)).toThrow(RailwayApiError);
    expect(() => new RailwayClient({})).toThrow(RailwayApiError);
    expect(() => new RailwayClient(null)).toThrow(RailwayApiError);
  });

  it('stores token and endpoint URL on valid construction', () => {
    const client = new RailwayClient(VALID_TOKEN);
    expect(client.token).toBe(VALID_TOKEN);
    expect(client.endpoint).toBe('https://backboard.railway.com/graphql/v2');
  });
});

// ---------------------------------------------------------------------------
// RailwayClient.query (low-level)
// ---------------------------------------------------------------------------

describe('RailwayClient.query', () => {
  it('returns data field on successful response and calls fetch correctly', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { foo: 'bar' } }));
    const client = new RailwayClient(VALID_TOKEN);

    const result = await client.query('{ foo }', { v: 1 });

    expect(result).toEqual({ foo: 'bar' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://backboard.railway.com/graphql/v2');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${VALID_TOKEN}`);
    expect(init.headers['Content-Type']).toBe('application/json');
    const parsedBody = JSON.parse(init.body);
    expect(parsedBody).toEqual({ query: '{ foo }', variables: { v: 1 } });
  });

  it('defaults variables to empty object if omitted', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    const client = new RailwayClient(VALID_TOKEN);

    await client.query('{ ok }');

    const parsedBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(parsedBody.variables).toEqual({});
  });

  it('returns empty object if data field is missing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const client = new RailwayClient(VALID_TOKEN);
    const result = await client.query('{ foo }');
    expect(result).toEqual({});
  });

  it('throws auth error on HTTP 401', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401, 'Unauthorized', 'bad token'));
    const client = new RailwayClient(VALID_TOKEN);
    try {
      await client.query('{ me { email } }');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RailwayApiError);
      expect(err.kind).toBe('auth');
      expect(err.status).toBe(401);
      expect(err.message).toMatch(/401/);
    }
  });

  it('throws auth error on HTTP 403', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(403, 'Forbidden', 'no scope'));
    const client = new RailwayClient(VALID_TOKEN);
    try {
      await client.query('{ me { email } }');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RailwayApiError);
      expect(err.kind).toBe('auth');
      expect(err.status).toBe(403);
    }
  });

  it('throws network error on HTTP 500', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'Server Error', 'oops'));
    const client = new RailwayClient(VALID_TOKEN);
    try {
      await client.query('{ me { email } }');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RailwayApiError);
      expect(err.kind).toBe('network');
      expect(err.status).toBe(500);
      expect(err.message).toMatch(/500/);
    }
  });

  it('throws network error when fetch itself rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const client = new RailwayClient(VALID_TOKEN);
    try {
      await client.query('{ me { email } }');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RailwayApiError);
      expect(err.kind).toBe('network');
      expect(err.message).toMatch(/ECONNREFUSED/);
      expect(err.request).toEqual({ query: '{ me { email } }', variables: {} });
    }
  });

  it('throws graphql error when response body contains errors array', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errors: [{ message: 'Field "nope" not found' }, { message: 'Second' }],
      }),
    );
    const client = new RailwayClient(VALID_TOKEN);
    try {
      await client.query('{ nope }');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RailwayApiError);
      expect(err.kind).toBe('graphql');
      expect(err.errors).toHaveLength(2);
      expect(err.errors[0].message).toBe('Field "nope" not found');
      expect(err.message).toMatch(/Field "nope" not found/);
    }
  });

  it('throws unknown error when body is not valid JSON', async () => {
    const res = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
      text: async () => '<html>nope</html>',
    };
    fetchMock.mockResolvedValueOnce(res);
    const client = new RailwayClient(VALID_TOKEN);
    try {
      await client.query('{ foo }');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RailwayApiError);
      expect(err.kind).toBe('unknown');
      expect(err.status).toBe(200);
      expect(err.message).toMatch(/non-JSON/);
    }
  });
});

// ---------------------------------------------------------------------------
// Wrapped methods
// ---------------------------------------------------------------------------

describe('RailwayClient.whoami', () => {
  it('returns email and name from me field', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { me: { email: 'a@b.com', name: 'Alice' } } }),
    );
    const client = new RailwayClient(VALID_TOKEN);
    const result = await client.whoami();
    expect(result).toEqual({ email: 'a@b.com', name: 'Alice' });
  });

  it('returns nulls if me is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { me: {} } }));
    const client = new RailwayClient(VALID_TOKEN);
    const result = await client.whoami();
    expect(result).toEqual({ email: null, name: null });
  });
});

describe('RailwayClient.listProjects', () => {
  it('flattens edges/nodes into array of {id, name}', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          me: {
            projects: {
              edges: [
                { node: { id: 'p1', name: 'alpha' } },
                { node: { id: 'p2', name: 'beta' } },
              ],
            },
          },
        },
      }),
    );
    const client = new RailwayClient(VALID_TOKEN);
    const result = await client.listProjects();
    expect(result).toEqual([
      { id: 'p1', name: 'alpha' },
      { id: 'p2', name: 'beta' },
    ]);
  });

  it('tolerates empty edges array', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { me: { projects: { edges: [] } } } }),
    );
    const client = new RailwayClient(VALID_TOKEN);
    expect(await client.listProjects()).toEqual([]);
  });

  it('tolerates missing me/projects structure entirely', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: {} }));
    const client = new RailwayClient(VALID_TOKEN);
    expect(await client.listProjects()).toEqual([]);
  });

  it('filters out null nodes from edges', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          me: {
            projects: {
              edges: [
                { node: { id: 'p1', name: 'alpha' } },
                { node: null },
                null,
              ],
            },
          },
        },
      }),
    );
    const client = new RailwayClient(VALID_TOKEN);
    expect(await client.listProjects()).toEqual([{ id: 'p1', name: 'alpha' }]);
  });
});

describe('RailwayClient.findProjectByName', () => {
  it('returns matching project', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'listProjects').mockResolvedValueOnce([
      { id: 'p1', name: 'alpha' },
      { id: 'p2', name: 'beta' },
    ]);
    const result = await client.findProjectByName('beta');
    expect(result).toEqual({ id: 'p2', name: 'beta' });
  });

  it('returns null on no match (does not throw)', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'listProjects').mockResolvedValueOnce([
      { id: 'p1', name: 'alpha' },
    ]);
    const result = await client.findProjectByName('missing');
    expect(result).toBeNull();
  });

  it('returns null on empty project list', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'listProjects').mockResolvedValueOnce([]);
    expect(await client.findProjectByName('anything')).toBeNull();
  });
});

describe('RailwayClient.createProject', () => {
  it('calls projectCreate mutation with stripped input and resolves default environment', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    const querySpy = vi
      .spyOn(client, 'query')
      // First call: projectCreate mutation
      .mockResolvedValueOnce({ projectCreate: { id: 'proj-123', name: 'my-app' } })
      // Second call: getDefaultEnvironment's projectEnvironments query
      .mockResolvedValueOnce({
        project: {
          environments: {
            edges: [{ node: { id: 'env-prod', name: 'production' } }],
          },
        },
      });

    const result = await client.createProject({
      name: 'my-app',
      description: undefined, // should be stripped
      workspaceId: 'ws-1',
    });

    expect(result).toEqual({
      id: 'proj-123',
      name: 'my-app',
      defaultEnvironmentId: 'env-prod',
      defaultEnvironmentName: 'production',
    });

    // First call: projectCreate with input containing only defined fields
    const firstCall = querySpy.mock.calls[0];
    expect(firstCall[0]).toMatch(/projectCreate/);
    expect(firstCall[1]).toEqual({
      input: {
        name: 'my-app',
        workspaceId: 'ws-1',
        defaultEnvironmentName: 'production', // default
      },
    });
    // No `description` key because we passed undefined
    expect(firstCall[1].input).not.toHaveProperty('description');
  });

  it('returns null environment fields if getDefaultEnvironment finds none', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'query')
      .mockResolvedValueOnce({ projectCreate: { id: 'proj-1', name: 'x' } })
      .mockResolvedValueOnce({ project: { environments: { edges: [] } } });

    const result = await client.createProject({ name: 'x' });
    expect(result).toEqual({
      id: 'proj-1',
      name: 'x',
      defaultEnvironmentId: null,
      defaultEnvironmentName: null,
    });
  });
});

describe('RailwayClient.getDefaultEnvironment', () => {
  it('returns the environment named "production" if present', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      project: {
        environments: {
          edges: [
            { node: { id: 'e1', name: 'staging' } },
            { node: { id: 'e2', name: 'production' } },
            { node: { id: 'e3', name: 'dev' } },
          ],
        },
      },
    });
    const result = await client.getDefaultEnvironment('proj-1');
    expect(result).toEqual({ id: 'e2', name: 'production' });
  });

  it('returns the first environment if no production exists', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      project: {
        environments: {
          edges: [
            { node: { id: 'e1', name: 'staging' } },
            { node: { id: 'e3', name: 'dev' } },
          ],
        },
      },
    });
    const result = await client.getDefaultEnvironment('proj-1');
    expect(result).toEqual({ id: 'e1', name: 'staging' });
  });

  it('returns null if there are no environments', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      project: { environments: { edges: [] } },
    });
    expect(await client.getDefaultEnvironment('proj-1')).toBeNull();
  });
});

describe('RailwayClient.listServices', () => {
  it('flattens edges/nodes into {id, name} array', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      project: {
        services: {
          edges: [
            { node: { id: 's1', name: 'api' } },
            { node: { id: 's2', name: 'worker' } },
          ],
        },
      },
    });
    const result = await client.listServices('proj-1');
    expect(result).toEqual([
      { id: 's1', name: 'api' },
      { id: 's2', name: 'worker' },
    ]);
  });

  it('tolerates empty edges', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      project: { services: { edges: [] } },
    });
    expect(await client.listServices('proj-1')).toEqual([]);
  });

  it('tolerates missing project structure', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'query').mockResolvedValueOnce({});
    expect(await client.listServices('proj-1')).toEqual([]);
  });
});

describe('RailwayClient.findServiceByName', () => {
  it('returns matching service', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'listServices').mockResolvedValueOnce([
      { id: 's1', name: 'api' },
      { id: 's2', name: 'worker' },
    ]);
    expect(await client.findServiceByName('proj-1', 'worker')).toEqual({
      id: 's2',
      name: 'worker',
    });
  });

  it('returns null on no match', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'listServices').mockResolvedValueOnce([{ id: 's1', name: 'api' }]);
    expect(await client.findServiceByName('proj-1', 'missing')).toBeNull();
  });
});

describe('RailwayClient.createService', () => {
  it('creates a new service when none exists', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'findServiceByName').mockResolvedValueOnce(null);
    const querySpy = vi
      .spyOn(client, 'query')
      .mockResolvedValueOnce({ serviceCreate: { id: 'svc-new', name: 'api' } });

    const result = await client.createService({
      projectId: 'proj-1',
      name: 'api',
      source: { repo: 'owner/api' },
      branch: 'main',
    });

    expect(result).toEqual({ id: 'svc-new', name: 'api' });
    expect(querySpy).toHaveBeenCalledTimes(1);
    const [sql, vars] = querySpy.mock.calls[0];
    expect(sql).toMatch(/serviceCreate/);
    expect(vars).toEqual({
      input: {
        projectId: 'proj-1',
        name: 'api',
        source: { repo: 'owner/api' },
        branch: 'main',
      },
    });
    // variables was undefined and should be stripped
    expect(vars.input).not.toHaveProperty('variables');
  });

  it('is idempotent: returns existing service without calling serviceCreate', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    const existing = { id: 'svc-existing', name: 'api' };
    vi.spyOn(client, 'findServiceByName').mockResolvedValueOnce(existing);
    const querySpy = vi.spyOn(client, 'query');

    const result = await client.createService({
      projectId: 'proj-1',
      name: 'api',
      source: { repo: 'owner/api' },
    });

    expect(result).toBe(existing);
    expect(querySpy).not.toHaveBeenCalled();
  });
});

describe('RailwayClient.updateServiceInstance', () => {
  it('strips undefined fields from input', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    const querySpy = vi.spyOn(client, 'query').mockResolvedValueOnce({});

    const result = await client.updateServiceInstance({
      serviceId: 'svc-1',
      environmentId: 'env-1',
      rootDirectory: 'apps/api',
      dockerfilePath: 'Dockerfile',
      startCommand: 'node dist/server.js',
      // these are all undefined — must be stripped
      healthcheckPath: undefined,
      restartPolicyType: undefined,
      restartPolicyMaxRetries: undefined,
      numReplicas: 2,
      region: undefined,
      buildCommand: undefined,
    });

    expect(result).toBe(true);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const [, vars] = querySpy.mock.calls[0];
    expect(vars.serviceId).toBe('svc-1');
    expect(vars.environmentId).toBe('env-1');
    expect(vars.input).toEqual({
      rootDirectory: 'apps/api',
      dockerfilePath: 'Dockerfile',
      startCommand: 'node dist/server.js',
      numReplicas: 2,
    });
    // Undefined keys stripped
    expect(vars.input).not.toHaveProperty('healthcheckPath');
    expect(vars.input).not.toHaveProperty('restartPolicyType');
    expect(vars.input).not.toHaveProperty('restartPolicyMaxRetries');
    expect(vars.input).not.toHaveProperty('region');
    expect(vars.input).not.toHaveProperty('buildCommand');
  });

  it('keeps null values (not stripped)', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    const querySpy = vi.spyOn(client, 'query').mockResolvedValueOnce({});

    await client.updateServiceInstance({
      serviceId: 'svc-1',
      environmentId: 'env-1',
      healthcheckPath: null,
    });

    const [, vars] = querySpy.mock.calls[0];
    expect(vars.input).toEqual({ healthcheckPath: null });
  });
});

describe('RailwayClient.upsertVariables', () => {
  it('passes variables through and defaults skipDeploys=true', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    const querySpy = vi.spyOn(client, 'query').mockResolvedValueOnce({});

    const result = await client.upsertVariables({
      projectId: 'proj-1',
      environmentId: 'env-1',
      serviceId: 'svc-1',
      variables: { DB_URL: 'postgres://x', API_KEY: 'secret' },
    });

    expect(result).toBe(true);
    const [sql, vars] = querySpy.mock.calls[0];
    expect(sql).toMatch(/variableCollectionUpsert/);
    expect(vars).toEqual({
      input: {
        projectId: 'proj-1',
        environmentId: 'env-1',
        serviceId: 'svc-1',
        variables: { DB_URL: 'postgres://x', API_KEY: 'secret' },
        replace: false,
        skipDeploys: true,
      },
    });
  });

  it('allows caller to override skipDeploys', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    const querySpy = vi.spyOn(client, 'query').mockResolvedValueOnce({});

    await client.upsertVariables({
      projectId: 'proj-1',
      environmentId: 'env-1',
      serviceId: null,
      variables: { X: '1' },
      skipDeploys: false,
    });

    const [, vars] = querySpy.mock.calls[0];
    expect(vars.input.skipDeploys).toBe(false);
    // serviceId: null is preserved (null is not stripped)
    expect(vars.input.serviceId).toBeNull();
  });
});

describe('RailwayClient.triggerDeploy', () => {
  it('calls environmentTriggersDeploy with the right input', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    const querySpy = vi.spyOn(client, 'query').mockResolvedValueOnce({});

    const result = await client.triggerDeploy({
      projectId: 'proj-1',
      environmentId: 'env-1',
      serviceId: 'svc-1',
    });

    expect(result).toBe(true);
    const [sql, vars] = querySpy.mock.calls[0];
    expect(sql).toMatch(/environmentTriggersDeploy/);
    expect(vars).toEqual({
      input: {
        projectId: 'proj-1',
        environmentId: 'env-1',
        serviceId: 'svc-1',
      },
    });
  });

  it('strips undefined fields from input', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    const querySpy = vi.spyOn(client, 'query').mockResolvedValueOnce({});

    await client.triggerDeploy({
      projectId: 'proj-1',
      environmentId: 'env-1',
      serviceId: undefined,
    });

    const [, vars] = querySpy.mock.calls[0];
    expect(vars.input).toEqual({
      projectId: 'proj-1',
      environmentId: 'env-1',
    });
    expect(vars.input).not.toHaveProperty('serviceId');
  });
});

describe('RailwayClient.assertSchemaCompatibility', () => {
  const ALL_REQUIRED = [
    'projectCreate',
    'serviceCreate',
    'serviceInstanceUpdate',
    'variableCollectionUpsert',
    'environmentTriggersDeploy',
  ];

  it('returns ok:true when all required mutations are present', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      __type: {
        fields: [
          ...ALL_REQUIRED.map((name) => ({ name })),
          { name: 'someOtherMutation' },
        ],
      },
    });
    const result = await client.assertSchemaCompatibility();
    expect(result).toEqual({ ok: true, missing: [] });
  });

  it('returns ok:false with the list of missing mutations', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      __type: {
        fields: [
          { name: 'projectCreate' },
          { name: 'serviceCreate' },
          // missing: serviceInstanceUpdate, variableCollectionUpsert, environmentTriggersDeploy
          { name: 'somethingElse' },
        ],
      },
    });
    const result = await client.assertSchemaCompatibility();
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([
      'serviceInstanceUpdate',
      'variableCollectionUpsert',
      'environmentTriggersDeploy',
    ]);
  });

  it('does not throw when introspection itself fails, returns sentinel missing', async () => {
    const client = new RailwayClient(VALID_TOKEN);
    vi.spyOn(client, 'query').mockRejectedValueOnce(
      new RailwayApiError('introspection blocked', { kind: 'graphql' }),
    );
    const result = await client.assertSchemaCompatibility();
    expect(result).toEqual({ ok: false, missing: ['(introspection failed)'] });
  });
});
