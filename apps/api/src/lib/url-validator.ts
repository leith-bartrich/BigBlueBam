import { URL } from 'node:url';
import { isIP } from 'node:net';

// ── SSRF URL Validation ────────────────────────────────────────────────
// Rejects URLs that resolve to private/internal IP ranges, loopback
// addresses, link-local addresses, and known cloud metadata endpoints.
// Used by Slack webhook and LLM provider integrations (BAM-020, BAM-021).

const PRIVATE_IPV4_RANGES = [
  // 10.0.0.0/8
  { start: [10, 0, 0, 0], mask: 8 },
  // 172.16.0.0/12
  { start: [172, 16, 0, 0], mask: 12 },
  // 192.168.0.0/16
  { start: [192, 168, 0, 0], mask: 16 },
  // 127.0.0.0/8 (loopback)
  { start: [127, 0, 0, 0], mask: 8 },
  // 169.254.0.0/16 (link-local)
  { start: [169, 254, 0, 0], mask: 16 },
  // 0.0.0.0/8
  { start: [0, 0, 0, 0], mask: 8 },
] as const;

const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'metadata.google',
];

function ipv4ToNum(parts: readonly number[]): number {
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const num = ipv4ToNum(parts);

  for (const range of PRIVATE_IPV4_RANGES) {
    const rangeStart = ipv4ToNum(range.start);
    const mask = (~0 << (32 - range.mask)) >>> 0;
    if ((num & mask) === (rangeStart & mask)) {
      return true;
    }
  }

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  // Normalize the IP — strip brackets if present
  const clean = ip.replace(/^\[|\]$/g, '');

  // ::1 (loopback)
  if (clean === '::1') return true;

  // fc00::/7 (unique local addresses)
  if (/^f[cd]/i.test(clean)) return true;

  // fe80::/10 (link-local)
  if (/^fe[89ab]/i.test(clean)) return true;

  // ::ffff:x.x.x.x (IPv4-mapped IPv6) — extract and check IPv4 part
  const v4Mapped = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Mapped) {
    return isPrivateIPv4(v4Mapped[1]!);
  }

  return false;
}

/**
 * Validates that a URL is safe to make outbound requests to (not an SSRF target).
 * Returns `{ safe: true }` or `{ safe: false, reason: string }`.
 */
export function validateExternalUrl(rawUrl: string): { safe: true } | { safe: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }

  // Only allow http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Only http and https URLs are allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known internal hostnames
  for (const blocked of BLOCKED_HOSTNAMES) {
    if (hostname === blocked) {
      return { safe: false, reason: `Hostname "${hostname}" is not allowed` };
    }
  }

  // Block cloud metadata endpoint IP
  if (hostname === '169.254.169.254') {
    return { safe: false, reason: 'Cloud metadata endpoint is not allowed' };
  }

  // Check if hostname is an IP address
  if (isIP(hostname) === 4) {
    if (isPrivateIPv4(hostname)) {
      return { safe: false, reason: 'Private/internal IPv4 addresses are not allowed' };
    }
  } else if (isIP(hostname) === 6 || hostname.startsWith('[')) {
    if (isPrivateIPv6(hostname)) {
      return { safe: false, reason: 'Private/internal IPv6 addresses are not allowed' };
    }
  }

  // Block hostnames that end with common internal suffixes
  if (hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    return { safe: false, reason: `Hostname "${hostname}" appears to be an internal address` };
  }

  return { safe: true };
}
