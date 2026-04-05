import type { FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';

/**
 * HB-7: Guard for the /internal/helpdesk/* surface.
 *
 * Inbound requests MUST carry an X-Internal-Token header whose value
 * matches INTERNAL_HELPDESK_SECRET. Comparison is timing-safe. As a
 * defense-in-depth layer we also allow-list the Docker internal bridge
 * network ranges (172.x private space) so a leaked token alone, from
 * outside the cluster, is not sufficient.
 *
 * Responds:
 *   401 UNAUTHORIZED — missing or mismatched token
 *   403 FORBIDDEN    — token OK but source IP outside the internal allow-list
 */
const INTERNAL_IP_PREFIXES = [
  '172.',    // docker bridge networks (172.16/12)
  '10.',     // k8s / private
  '127.',    // loopback (tests, local dev)
  '::1',     // IPv6 loopback
  '::ffff:127.', // IPv4-mapped loopback
  '::ffff:172.',
  '::ffff:10.',
];

function isInternalAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  return INTERNAL_IP_PREFIXES.some((p) => ip.startsWith(p));
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still perform a constant-time compare against bufA to avoid a length
    // oracle, then return false.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function requireServiceAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const header = request.headers['x-internal-token'];
  const provided = Array.isArray(header) ? header[0] : header;

  if (!provided || typeof provided !== 'string') {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing internal service token',
        details: [],
        request_id: request.id,
      },
    });
  }

  const expected = env.INTERNAL_HELPDESK_SECRET;
  if (!timingSafeStringEqual(provided, expected)) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid internal service token',
        details: [],
        request_id: request.id,
      },
    });
  }

  if (!isInternalAddress(request.ip)) {
    request.log.warn(
      { ip: request.ip, url: request.url },
      'require-service-auth: valid token but source IP not in internal allow-list',
    );
    return reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'Internal endpoints are not reachable from this network',
        details: [],
        request_id: request.id,
      },
    });
  }

  request.log.info(
    { url: request.url, caller: 'helpdesk-api' },
    'internal service call authorized',
  );
}
