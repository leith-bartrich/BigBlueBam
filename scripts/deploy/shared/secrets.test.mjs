// secrets.test.mjs
//
// Unit tests for buildEnvConfig() and promptHostPortExposure() at secrets.mjs.
// buildEnvConfig is the pure-function load-bearing piece (it maps prompts +
// choices into the envConfig object that writeEnvFile serializes into .env),
// so it gets the bulk of the coverage. promptHostPortExposure is glue around
// ./prompt.mjs; we mock that module and run one happy-path and one
// invalid-input-retry case to prove the wiring holds.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./prompt.mjs', () => ({
  ask: vi.fn(),
  askPassword: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  banner: vi.fn(),
}));

import { ask, confirm } from './prompt.mjs';
import {
  buildEnvConfig,
  generateSecrets,
  promptHostPortExposure,
} from './secrets.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal valid `choices` arg for buildEnvConfig. Individual tests override
 * whichever field they care about.
 */
function makeChoices(overrides = {}) {
  return {
    secrets: generateSecrets(),
    storage: { storageProvider: 'minio' },
    vectorDb: { vectorProvider: 'qdrant-local' },
    livekit: { livekitProvider: 'livekit-local' },
    integrations: {},
    domain: 'bbb.example.com',
    hostPorts: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildEnvConfig — host port exposure wiring
// ---------------------------------------------------------------------------

describe('buildEnvConfig — host port exposure', () => {
  it('omits HTTP_PORT and HTTPS_PORT when hostPorts is undefined (Railway or pre-PR call sites)', () => {
    const env = buildEnvConfig(makeChoices({ hostPorts: undefined }));
    expect(env).not.toHaveProperty('HTTP_PORT');
    expect(env).not.toHaveProperty('HTTPS_PORT');
  });

  it('writes HTTP_PORT at the default 80 with no HTTPS bind', () => {
    const env = buildEnvConfig(makeChoices({
      hostPorts: { HTTP_PORT: '80', bindHttps: false },
    }));
    expect(env.HTTP_PORT).toBe('80');
    expect(env).not.toHaveProperty('HTTPS_PORT');
  });

  it('writes HTTP_PORT at a custom value with no HTTPS bind', () => {
    const env = buildEnvConfig(makeChoices({
      hostPorts: { HTTP_PORT: '18080', bindHttps: false },
    }));
    expect(env.HTTP_PORT).toBe('18080');
    expect(env).not.toHaveProperty('HTTPS_PORT');
  });

  it('writes both HTTP_PORT and HTTPS_PORT when the optional HTTPS bind is opted in at 443', () => {
    const env = buildEnvConfig(makeChoices({
      hostPorts: { HTTP_PORT: '80', bindHttps: true, HTTPS_PORT: '443' },
    }));
    expect(env.HTTP_PORT).toBe('80');
    expect(env.HTTPS_PORT).toBe('443');
  });

  it('writes a custom HTTPS_PORT when the optional HTTPS bind is opted in at a non-default port', () => {
    const env = buildEnvConfig(makeChoices({
      hostPorts: { HTTP_PORT: '18080', bindHttps: true, HTTPS_PORT: '18443' },
    }));
    expect(env.HTTP_PORT).toBe('18080');
    expect(env.HTTPS_PORT).toBe('18443');
  });

  it('refuses to write HTTPS_PORT when bindHttps is false even if HTTPS_PORT is present', () => {
    // Defensive: callers shouldn't set HTTPS_PORT without bindHttps:true, but
    // if they do, the bind is still suppressed because buildEnvConfig keys
    // off bindHttps. This prevents accidental 443 binds from stale state.
    const env = buildEnvConfig(makeChoices({
      hostPorts: { HTTP_PORT: '80', bindHttps: false, HTTPS_PORT: '443' },
    }));
    expect(env.HTTP_PORT).toBe('80');
    expect(env).not.toHaveProperty('HTTPS_PORT');
  });
});

// ---------------------------------------------------------------------------
// buildEnvConfig — public URL derivation
// ---------------------------------------------------------------------------

describe('buildEnvConfig — public URL derivation', () => {
  it('derives CORS_ORIGIN, FRONTEND_URL, PUBLIC_URL from a real domain', () => {
    const env = buildEnvConfig(makeChoices({ domain: 'bbb.example.com' }));
    expect(env.CORS_ORIGIN).toBe('https://bbb.example.com');
    expect(env.FRONTEND_URL).toBe('https://bbb.example.com/b3');
    expect(env.PUBLIC_URL).toBe('https://bbb.example.com');
    expect(env.BASE_URL).toBe('https://bbb.example.com');
    expect(env.DOMAIN).toBe('bbb.example.com');
  });

  it('falls back to http://localhost variants when domain is empty', () => {
    const env = buildEnvConfig(makeChoices({ domain: '' }));
    expect(env.CORS_ORIGIN).toBe('http://localhost');
    expect(env.FRONTEND_URL).toBe('http://localhost/b3');
    expect(env.PUBLIC_URL).toBe('http://localhost');
    expect(env.BASE_URL).toBe('http://localhost');
    expect(env.DOMAIN).toBe('localhost');
  });

  it('pins the pre-existing localhost-gets-https-scheme quirk (out of scope to fix)', () => {
    // If the operator literally types "localhost" at the domain prompt, the
    // ternary in buildEnvConfig treats the truthy string as a real domain and
    // produces https://localhost for every URL. That quirk predates this PR
    // (it already applied to BASE_URL) and is preserved here; fixing it is a
    // separate concern.
    const env = buildEnvConfig(makeChoices({ domain: 'localhost' }));
    expect(env.BASE_URL).toBe('https://localhost');
    expect(env.CORS_ORIGIN).toBe('https://localhost');
    expect(env.FRONTEND_URL).toBe('https://localhost/b3');
    expect(env.PUBLIC_URL).toBe('https://localhost');
  });
});

// ---------------------------------------------------------------------------
// buildEnvConfig — existing contract (regression guards)
// ---------------------------------------------------------------------------

describe('buildEnvConfig — existing contract', () => {
  it('builds DATABASE_URL from POSTGRES_PASSWORD', () => {
    const secrets = generateSecrets();
    const env = buildEnvConfig(makeChoices({ secrets }));
    expect(env.DATABASE_URL).toBe(
      `postgresql://bigbluebam:${secrets.POSTGRES_PASSWORD}@postgres:5432/bigbluebam`,
    );
  });

  it('builds REDIS_URL from REDIS_PASSWORD', () => {
    const secrets = generateSecrets();
    const env = buildEnvConfig(makeChoices({ secrets }));
    expect(env.REDIS_URL).toBe(`redis://:${secrets.REDIS_PASSWORD}@redis:6379`);
  });

  it('sets NODE_ENV=production', () => {
    const env = buildEnvConfig(makeChoices());
    expect(env.NODE_ENV).toBe('production');
  });

  it('wires local MinIO endpoint and credentials when storage provider is minio', () => {
    const secrets = generateSecrets();
    const env = buildEnvConfig(makeChoices({
      secrets,
      storage: { storageProvider: 'minio' },
    }));
    expect(env.S3_ENDPOINT).toBe('http://minio:9000');
    expect(env.S3_ACCESS_KEY).toBe(secrets.MINIO_ROOT_USER);
    expect(env.S3_SECRET_KEY).toBe(secrets.MINIO_ROOT_PASSWORD);
    expect(env.S3_FORCE_PATH_STYLE).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// promptHostPortExposure — happy path + validation loop
// ---------------------------------------------------------------------------

describe('promptHostPortExposure', () => {
  beforeEach(() => {
    ask.mockReset();
    confirm.mockReset();
  });

  it('returns HTTP 80 + no HTTPS bind when the operator accepts all defaults', async () => {
    // askPort wraps ask(); ask() resolves the default when the user hits
    // enter, so with the default 80 we get '80' back. confirm() defaults to
    // false for the optional-HTTPS question.
    ask.mockResolvedValueOnce('80');
    confirm.mockResolvedValueOnce(false);

    const result = await promptHostPortExposure();

    expect(result).toEqual({ HTTP_PORT: '80', bindHttps: false });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('returns custom HTTP port + HTTPS at 443 when the operator opts in', async () => {
    ask.mockResolvedValueOnce('18080'); // HTTP port
    confirm.mockResolvedValueOnce(true); // yes, bind HTTPS
    ask.mockResolvedValueOnce('443');    // HTTPS port (default)

    const result = await promptHostPortExposure();

    expect(result).toEqual({ HTTP_PORT: '18080', bindHttps: true, HTTPS_PORT: '443' });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('returns custom ports on both axes when the operator picks non-defaults', async () => {
    ask.mockResolvedValueOnce('18080');
    confirm.mockResolvedValueOnce(true);
    ask.mockResolvedValueOnce('18443');

    const result = await promptHostPortExposure();

    expect(result).toEqual({ HTTP_PORT: '18080', bindHttps: true, HTTPS_PORT: '18443' });
  });

  it('re-prompts on invalid HTTP port input until a valid integer is given', async () => {
    // askPort keeps asking until a 1..65535 integer comes back. The mocks
    // supply garbage, then out-of-range, then a valid answer.
    ask.mockResolvedValueOnce('not-a-port');
    ask.mockResolvedValueOnce('0');
    ask.mockResolvedValueOnce('70000');
    ask.mockResolvedValueOnce('8080');
    confirm.mockResolvedValueOnce(false);

    const result = await promptHostPortExposure();

    expect(result.HTTP_PORT).toBe('8080');
    expect(ask).toHaveBeenCalledTimes(4);
  });

  it('re-prompts on invalid HTTPS port input until a valid integer is given', async () => {
    ask.mockResolvedValueOnce('80');  // valid HTTP
    confirm.mockResolvedValueOnce(true); // opt in to HTTPS
    ask.mockResolvedValueOnce('abc'); // invalid HTTPS
    ask.mockResolvedValueOnce('443'); // valid HTTPS

    const result = await promptHostPortExposure();

    expect(result).toEqual({ HTTP_PORT: '80', bindHttps: true, HTTPS_PORT: '443' });
    expect(ask).toHaveBeenCalledTimes(3);
  });
});
