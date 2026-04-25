// Unit tests for tls.mjs. The cert-generation tests actually shell out to
// openssl (which is on every CI runner with Docker installed), so the
// generated cert/key files are real and the validateCertKeyPair pairing
// check is exercised end-to-end.

import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  pickHstsHeader,
  generateSelfSigned,
  validateCertKeyPair,
  detectMkcert,
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

  it('falls back to max-age=300 for unknown sources', () => {
    expect(pickHstsHeader('something-else')).toBe('max-age=300');
    expect(pickHstsHeader(undefined)).toBe('max-age=300');
  });
});

describe('CERT_SOURCES + HTTP_MODES enums', () => {
  it('exposes the four cert sources', () => {
    expect(CERT_SOURCES).toContain('self-signed');
    expect(CERT_SOURCES).toContain('mkcert');
    expect(CERT_SOURCES).toContain('byo');
    expect(CERT_SOURCES).toContain('letsencrypt');
    expect(CERT_SOURCES).toHaveLength(4);
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
