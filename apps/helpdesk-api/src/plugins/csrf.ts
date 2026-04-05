import fp from 'fastify-plugin';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';

/**
 * HB-52: CSRF protection via double-submit cookie token.
 *
 * Protects helpdesk customer session-cookie-authenticated state-changing
 * endpoints. Agent routes authenticated via Bearer API key skip this check.
 *
 * See apps/api/src/plugins/csrf.ts for the full design rationale.
 */

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const EXEMPT_PATHS = new Set([
  '/helpdesk/auth/login',
  '/helpdesk/auth/register',
  '/helpdesk/auth/logout',
  '/helpdesk/auth/verify-email',
]);

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function issueCsrfToken(reply: FastifyReply): string {
  const token = generateToken();
  reply.setCookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
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

async function helpdeskCsrfPlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();
    if (!MUTATING_METHODS.has(method)) return;

    // Agent routes (Bearer API key) skip CSRF.
    const authHeader = request.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return;
    }

    // Enforce CSRF if the request carries any session cookie: either a
    // helpdesk customer session OR a BBB admin session (some helpdesk-api
    // admin routes accept the BBB `session` cookie as cross-app auth, e.g.
    // /helpdesk/settings). Both cookie paths set a matching csrf_token.
    const sessionCookie =
      request.cookies?.helpdesk_session ?? request.cookies?.session;
    if (!sessionCookie) return;

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

export default fp(helpdeskCsrfPlugin, {
  name: 'helpdesk-csrf',
  dependencies: ['@fastify/cookie'],
});
