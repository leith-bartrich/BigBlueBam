import fp from 'fastify-plugin';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';

/**
 * HB-52: CSRF protection via double-submit cookie token.
 *
 * Flow:
 *  1. On successful login/register/switch-org, the route handler calls
 *     issueCsrfToken(reply) which sets a `csrf_token` cookie (httpOnly=false
 *     so the SPA can read it via document.cookie).
 *  2. The SPA echoes the cookie value in `X-CSRF-Token` on every state-
 *     changing request.
 *  3. The preHandler hook below verifies header === cookie for
 *     POST/PUT/PATCH/DELETE requests that carry a session cookie.
 *
 * Bearer-token (API key) requests SKIP the CSRF check entirely — the token
 * is not auto-sent by browsers so CSRF isn't an attack vector. Login,
 * register, and logout endpoints also skip (chicken-and-egg: no token
 * exists yet).
 *
 * SameSite=Lax on the session cookie already blocks most CSRF; this
 * layer closes the gap for older browsers and for same-site POSTs that
 * would otherwise slip through SameSite=Lax.
 */

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// State-changing methods that must carry a CSRF token under session auth.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Endpoints exempt from CSRF enforcement. Login/register have no pre-existing
// token (chicken-and-egg); logout should succeed so users can always sign
// out even if their token cookie is stripped.
const EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/logout',
]);

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function issueCsrfToken(reply: FastifyReply): string {
  const token = generateToken();
  reply.setCookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // SPA must be able to read it
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    domain: env.COOKIE_DOMAIN,
    maxAge: env.SESSION_TTL_SECONDS,
  });
  return token;
}

function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

async function csrfPlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();
    if (!MUTATING_METHODS.has(method)) return;

    // Bearer token auth: CSRF is not a concern (header isn't auto-sent).
    const authHeader = request.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return;
    }

    // No session cookie → this is likely an unauth request that the
    // route itself will reject. Either way, CSRF enforcement only
    // matters when a session cookie could be replayed.
    const sessionCookie = request.cookies?.session;
    if (!sessionCookie) return;

    // Exempt auth bootstrap endpoints.
    const url = request.routeOptions?.url ?? request.url.split('?')[0] ?? request.url;
    if (EXEMPT_PATHS.has(url)) return;

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerRaw = request.headers[CSRF_HEADER_NAME];
    const headerToken = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;

    if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
      return reply.status(403).send({
        error: {
          code: 'CSRF_MISMATCH',
          message: 'CSRF token missing or invalid',
          details: [],
          request_id: request.id,
        },
      });
    }
  });
}

export default fp(csrfPlugin, {
  name: 'csrf',
  dependencies: ['@fastify/cookie'],
});
