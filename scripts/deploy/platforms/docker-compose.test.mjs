// docker-compose.test.mjs
//
// Unit tests for writeEnvFile() and buildComposeFiles() at docker-compose.mjs.
// Both are pure-ish helpers (writeEnvFile touches disk; buildComposeFiles
// stats a directory), so the tests use real temp dirs rather than mocking fs.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildComposeFiles,
  writeEnvFile,
} from './docker-compose.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bbb-deploy-test-'));
}

/**
 * Parse a generated .env file into a `{ key: value }` map. Section-header
 * comments (`# --- Foo ---`) are returned under the special `__sections__`
 * key as an ordered list so tests can assert on section placement.
 */
function parseEnvFile(text) {
  const keys = {};
  const sections = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('# ---')) {
      sections.push(line);
      continue;
    }
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    keys[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return { keys, sections };
}

// ---------------------------------------------------------------------------
// buildComposeFiles
// ---------------------------------------------------------------------------

describe('buildComposeFiles', () => {
  let tmpdir;

  beforeEach(() => { tmpdir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpdir, { recursive: true, force: true }); });

  it('returns only the base compose file when no overlays apply', () => {
    const files = buildComposeFiles({}, { cwd: tmpdir });
    expect(files).toEqual(['-f', 'docker-compose.yml']);
  });

  it('layers in docker-compose.site.yml when site/package.json exists', () => {
    fs.mkdirSync(path.join(tmpdir, 'site'));
    fs.writeFileSync(path.join(tmpdir, 'site', 'package.json'), '{}');
    const files = buildComposeFiles({}, { cwd: tmpdir });
    expect(files).toEqual([
      '-f', 'docker-compose.yml',
      '-f', 'docker-compose.site.yml',
    ]);
  });

  it('does NOT layer in docker-compose.site.yml when site/ has no package.json', () => {
    // Empty site/ directory — the existing guard requires the package.json to
    // be present, so a bare directory should not trigger the overlay.
    fs.mkdirSync(path.join(tmpdir, 'site'));
    const files = buildComposeFiles({}, { cwd: tmpdir });
    expect(files).toEqual(['-f', 'docker-compose.yml']);
  });

  it('layers in docker-compose.ssl.yml when envConfig.HTTPS_PORT is set', () => {
    const files = buildComposeFiles({ HTTPS_PORT: '443' }, { cwd: tmpdir });
    expect(files).toEqual([
      '-f', 'docker-compose.yml',
      '-f', 'docker-compose.ssl.yml',
    ]);
  });

  it('honors a custom HTTPS_PORT value', () => {
    const files = buildComposeFiles({ HTTPS_PORT: '18443' }, { cwd: tmpdir });
    expect(files).toContain('docker-compose.ssl.yml');
    // The port itself is substituted at `docker compose` time from .env; the
    // file assembly is agnostic to which port was picked.
  });

  it('layers in BOTH overlays when site/ and HTTPS_PORT are present', () => {
    fs.mkdirSync(path.join(tmpdir, 'site'));
    fs.writeFileSync(path.join(tmpdir, 'site', 'package.json'), '{}');
    const files = buildComposeFiles({ HTTPS_PORT: '443' }, { cwd: tmpdir });
    expect(files).toEqual([
      '-f', 'docker-compose.yml',
      '-f', 'docker-compose.site.yml',
      '-f', 'docker-compose.ssl.yml',
    ]);
  });

  it('does NOT layer in docker-compose.ssl.yml when HTTPS_PORT is absent', () => {
    // Default Docker Compose path — operator accepted the "no HTTPS bind"
    // default at the Host port exposure prompt.
    const files = buildComposeFiles({ HTTP_PORT: '80' }, { cwd: tmpdir });
    expect(files).not.toContain('docker-compose.ssl.yml');
  });
});

// ---------------------------------------------------------------------------
// writeEnvFile
// ---------------------------------------------------------------------------

describe('writeEnvFile', () => {
  let tmpdir;
  let originalCwd;

  beforeEach(() => {
    tmpdir = makeTempDir();
    originalCwd = process.cwd();
    process.chdir(tmpdir);
  });
  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  it('writes the .env file to the current working directory with mode 0600', () => {
    const envPath = writeEnvFile({ POSTGRES_USER: 'u', POSTGRES_PASSWORD: 'p' });
    expect(envPath).toBe(path.resolve(tmpdir, '.env'));
    expect(fs.existsSync(envPath)).toBe(true);
    const stat = fs.statSync(envPath);
    // On POSIX the file is chmod'd 0600; accept any owner-only read/write.
    if (process.platform !== 'win32') {
      expect(stat.mode & 0o777).toBe(0o600);
    }
  });

  it('places HTTP_PORT and HTTPS_PORT under the new Host port exposure section', () => {
    writeEnvFile({
      POSTGRES_USER: 'u',
      POSTGRES_PASSWORD: 'p',
      HTTP_PORT: '18080',
      HTTPS_PORT: '18443',
    });
    const content = fs.readFileSync('.env', 'utf8');
    const { keys, sections } = parseEnvFile(content);
    expect(keys.HTTP_PORT).toBe('18080');
    expect(keys.HTTPS_PORT).toBe('18443');
    expect(sections).toContain('# --- Host port exposure ---');
    // The port keys must appear between the Host port exposure header and the
    // next `# ---` header, which we verify by text-position ordering.
    const header = content.indexOf('# --- Host port exposure ---');
    const httpLine = content.indexOf('HTTP_PORT=18080');
    expect(header).toBeGreaterThan(-1);
    expect(httpLine).toBeGreaterThan(header);
  });

  it('omits HTTP_PORT and HTTPS_PORT entirely when neither is set', () => {
    writeEnvFile({ POSTGRES_USER: 'u', POSTGRES_PASSWORD: 'p' });
    const content = fs.readFileSync('.env', 'utf8');
    expect(content).not.toContain('HTTP_PORT=');
    expect(content).not.toContain('HTTPS_PORT=');
    // The section header must also be suppressed when the section has no
    // populated keys — writeEnvFile's existing contract.
    expect(content).not.toContain('# --- Host port exposure ---');
  });

  it('emits HTTP_PORT under the section even when HTTPS_PORT is absent', () => {
    writeEnvFile({ POSTGRES_USER: 'u', POSTGRES_PASSWORD: 'p', HTTP_PORT: '80' });
    const content = fs.readFileSync('.env', 'utf8');
    expect(content).toContain('# --- Host port exposure ---');
    expect(content).toContain('HTTP_PORT=80');
    expect(content).not.toContain('HTTPS_PORT=');
  });

  it('places CORS_ORIGIN, FRONTEND_URL, PUBLIC_URL under the Core section', () => {
    writeEnvFile({
      DOMAIN: 'bbb.example.com',
      BASE_URL: 'https://bbb.example.com',
      CORS_ORIGIN: 'https://bbb.example.com',
      FRONTEND_URL: 'https://bbb.example.com/b3',
      PUBLIC_URL: 'https://bbb.example.com',
      POSTGRES_USER: 'u',
      POSTGRES_PASSWORD: 'p',
    });
    const content = fs.readFileSync('.env', 'utf8');
    const coreHeader = content.indexOf('# --- Core ---');
    const nextSectionHeader = content.indexOf('# ---', coreHeader + 1);
    const coreBlock = content.slice(coreHeader, nextSectionHeader);
    expect(coreBlock).toContain('DOMAIN=bbb.example.com');
    expect(coreBlock).toContain('CORS_ORIGIN=https://bbb.example.com');
    expect(coreBlock).toContain('FRONTEND_URL=https://bbb.example.com/b3');
    expect(coreBlock).toContain('PUBLIC_URL=https://bbb.example.com');
  });

  it('skips keys with null or empty string values', () => {
    writeEnvFile({
      POSTGRES_USER: 'u',
      POSTGRES_PASSWORD: 'p',
      HTTP_PORT: '',
      HTTPS_PORT: null,
      SMTP_HOST: undefined,
    });
    const content = fs.readFileSync('.env', 'utf8');
    expect(content).not.toContain('HTTP_PORT=');
    expect(content).not.toContain('HTTPS_PORT=');
    expect(content).not.toContain('SMTP_HOST=');
  });
});
