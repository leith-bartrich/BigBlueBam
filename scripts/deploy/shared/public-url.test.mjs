// Unit tests for public-url.mjs.

import { describe, expect, it } from 'vitest';
import { formatPublicUrl, pickScheme, parsePort } from './public-url.mjs';

describe('formatPublicUrl', () => {
  it('returns http://localhost when domain is localhost and ports default', () => {
    expect(formatPublicUrl({ domain: 'localhost' })).toBe('http://localhost');
  });

  it('returns http://localhost:8080 when HTTP_PORT is remapped', () => {
    expect(formatPublicUrl({ domain: 'localhost', httpPort: 8080 })).toBe('http://localhost:8080');
  });

  it('returns https://example.com (no port) for default https', () => {
    expect(formatPublicUrl({ domain: 'example.com' })).toBe('https://example.com');
  });

  it('returns https://example.com:8443 when HTTPS_PORT is remapped', () => {
    expect(formatPublicUrl({ domain: 'example.com', httpsPort: 8443 })).toBe('https://example.com:8443');
  });

  it('honors useTls=false to force http even on a non-localhost domain', () => {
    // The NAS-at-nas.local case: no certificate, plain http.
    expect(formatPublicUrl({ domain: 'nas.local', httpPort: 8080, useTls: false }))
      .toBe('http://nas.local:8080');
  });

  it('honors useTls=true to force https on localhost', () => {
    expect(formatPublicUrl({ domain: 'localhost', httpsPort: 443, useTls: true }))
      .toBe('https://localhost');
  });

  it('omits a default port even when explicitly passed', () => {
    expect(formatPublicUrl({ domain: 'example.com', httpsPort: 443 })).toBe('https://example.com');
    expect(formatPublicUrl({ domain: 'localhost', httpPort: 80 })).toBe('http://localhost');
  });

  it('treats raw IPv4 as plain-http (no inferred TLS)', () => {
    expect(formatPublicUrl({ domain: '192.168.1.10', httpPort: 8080 }))
      .toBe('http://192.168.1.10:8080');
  });

  it('falls back to localhost when domain is empty', () => {
    expect(formatPublicUrl({ domain: '' })).toBe('http://localhost');
  });
});

describe('pickScheme', () => {
  it('picks http for localhost', () => {
    expect(pickScheme('localhost')).toBe('http');
  });

  it('picks http for raw IPv4', () => {
    expect(pickScheme('10.0.0.5')).toBe('http');
  });

  it('picks https for a hostname', () => {
    expect(pickScheme('example.com')).toBe('https');
  });

  it('respects an explicit useTls override', () => {
    expect(pickScheme('localhost', { useTls: true })).toBe('https');
    expect(pickScheme('example.com', { useTls: false })).toBe('http');
  });
});

describe('parsePort', () => {
  it('parses valid integers in range', () => {
    expect(parsePort('80')).toBe(80);
    expect(parsePort('8080')).toBe(8080);
    expect(parsePort(443)).toBe(443);
    expect(parsePort('  9000  ')).toBe(9000);
  });

  it('rejects values out of range', () => {
    expect(parsePort('0')).toBe(null);
    expect(parsePort('65536')).toBe(null);
    expect(parsePort('-1')).toBe(null);
  });

  it('rejects non-numeric input', () => {
    expect(parsePort('eighty')).toBe(null);
    expect(parsePort('')).toBe(null);
    expect(parsePort(null)).toBe(null);
    expect(parsePort(undefined)).toBe(null);
  });
});
