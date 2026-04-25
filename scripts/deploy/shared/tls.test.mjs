// Unit tests for tls.mjs. The cert-generation tests actually shell out to
// openssl (which is on every CI runner with Docker installed), so the
// generated cert/key files are real and the validateCertKeyPair pairing
// check is exercised end-to-end.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

vi.mock('./prompt.mjs', () => ({
  ask: vi.fn(),
  askPassword: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  banner: vi.fn(),
}));

import { select } from './prompt.mjs';
import {
  pickHstsHeader,
  generateSelfSigned,
  validateCertKeyPair,
  detectMkcert,
  provisionCerts,
  promptTlsConfig,
  CERT_SOURCES,
  HTTP_MODES,
} from './tls.mjs';

describe('pickHstsHeader', () => {
  it('returns the long-lived header only for letsencrypt', () => {
    expect(pickHstsHeader('letsencrypt')).toBe('max-age=31536000; includeSubDomains');
  });

  it('returns the conservative max-age=300 header for self-signed', () => {
    expect(pickHstsHeader('self-signed')).toBe('max-age=300');
  });

  it('returns max-age=300 for mkcert and byo (avoid HSTS pin poisoning)', () => {
    expect(pickHstsHeader('mkcert')).toBe('max-age=300');
    expect(pickHstsHeader('byo')).toBe('max-age=300');
  });

  it('returns null for reverse-proxy (HSTS belongs to the upstream layer)', () => {
    expect(pickHstsHeader('reverse-proxy')).toBeNull();
  });

  it('falls back to max-age=300 for unknown sources', () => {
    expect(pickHstsHeader('something-else')).toBe('max-age=300');
    expect(pickHstsHeader(undefined)).toBe('max-age=300');
  });
});

describe('CERT_SOURCES + HTTP_MODES enums', () => {
  it('exposes the five cert sources including reverse-proxy', () => {
    expect(CERT_SOURCES).toContain('self-signed');
    expect(CERT_SOURCES).toContain('mkcert');
    expect(CERT_SOURCES).toContain('byo');
    expect(CERT_SOURCES).toContain('letsencrypt');
    expect(CERT_SOURCES).toContain('reverse-proxy');
    expect(CERT_SOURCES).toHaveLength(5);
  });

  it('exposes the three http modes', () => {
    expect(HTTP_MODES).toEqual(['redirect', 'both', 'https-only']);
  });
});

describe('detectMkcert', () => {
  it('returns null or a string', () => {
    // Doesn't actually require mkcert installed; just verifies the
    // detection path returns one of the two valid shapes.
    const result = detectMkcert();
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

describe('generateSelfSigned + validateCertKeyPair', () => {
  let tmpDir;
  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('mints a valid cert+key pair that survives modulus pairing check', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbb-tls-test-'));
    const result = generateSelfSigned({ domain: 'localhost', certsDir: tmpDir });
    expect(fs.existsSync(result.certPath)).toBe(true);
    expect(fs.existsSync(result.keyPath)).toBe(true);

    const validation = validateCertKeyPair(result.certPath, result.keyPath);
    expect(validation.ok).toBe(true);
  });

  it('mints a cert that names the requested domain in its CN', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbb-tls-test-'));
    generateSelfSigned({ domain: 'nas.local', certsDir: tmpDir });
    const certPath = path.join(tmpDir, 'local.crt');
    // openssl x509 -noout -subject prints "subject=CN=...". Use that as a
    // smoke check that the SAN config flowed through.
    const { execSync } = require('node:child_process');
    const subject = execSync(`openssl x509 -noout -subject -in "${certPath}"`).toString();
    expect(subject).toContain('nas.local');
  });

  it('rejects a mismatched cert and key as a non-pair', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbb-tls-test-'));
    const a = generateSelfSigned({ domain: 'a.local', certsDir: path.join(tmpDir, 'a') });
    const b = generateSelfSigned({ domain: 'b.local', certsDir: path.join(tmpDir, 'b') });

    // Cross-pairing: a's cert with b's key — must fail.
    const validation = validateCertKeyPair(a.certPath, b.keyPath);
    expect(validation.ok).toBe(false);
    expect(validation.reason).toMatch(/modulus mismatch|do not pair/);
  });

  it('rejects a missing file path with a clear reason', () => {
    const validation = validateCertKeyPair('/nonexistent/cert.pem', '/nonexistent/key.pem');
    expect(validation.ok).toBe(false);
    expect(validation.reason).toMatch(/not found/i);
  });
});

describe('provisionCerts — reverse-proxy', () => {
  let tmpDir;
  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns null and writes nothing for source=reverse-proxy', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbb-tls-test-'));
    const result = provisionCerts(
      { source: 'reverse-proxy', httpMode: 'none', byo: null, letsencrypt: null },
      { domain: 'bbb.example.com', certsDir: tmpDir },
    );
    expect(result).toBeNull();
    // The certs directory should not be created or populated by the
    // reverse-proxy path — an upstream layer holds the cert material.
    if (fs.existsSync(tmpDir)) {
      expect(fs.readdirSync(tmpDir)).toEqual([]);
    }
  });
});

describe('promptTlsConfig — reverse-proxy', () => {
  beforeEach(() => {
    select.mockReset();
  });

  it('returns the reverse-proxy shape when picked on the first prompt', async () => {
    select.mockResolvedValueOnce('reverse-proxy');

    const result = await promptTlsConfig({ useTls: true, httpPort: 80, httpsPort: 443 });

    // byo/letsencrypt are optional (`?:` in the JSDoc) and conditionally
    // spread, so they're absent from the return when unset.
    expect(result).toEqual({ source: 'reverse-proxy', httpMode: 'none' });
    // Only one select should have fired — the cert-source picker. The
    // HTTP-coexistence prompt is suppressed for this source because the
    // entrypoint ignores it (TLS_HTTP_MODE=none → plain HTTP only).
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('returns the reverse-proxy shape when picked via the LE-port-mismatch fallback', async () => {
    // Operator initially picked LE; HTTP_PORT is non-default so LE refuses
    // and the script offers a fallback select. Operator then picks
    // reverse-proxy from the fallback. Final config should still be the
    // clean reverse-proxy shape.
    select.mockResolvedValueOnce('letsencrypt');
    select.mockResolvedValueOnce('reverse-proxy');

    const result = await promptTlsConfig({ useTls: true, httpPort: 18080, httpsPort: 443 });

    expect(result).toEqual({
      source: 'reverse-proxy',
      httpMode: 'none',
    });
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('returns null when useTls is false (existing behavior pinned)', async () => {
    const result = await promptTlsConfig({ useTls: false, httpPort: 80, httpsPort: 443 });
    expect(result).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });
});
