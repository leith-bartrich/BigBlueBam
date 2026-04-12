import type { FastifyInstance } from 'fastify';
import * as trackingService from '../services/tracking.service.js';

/** Escape user-derived strings for safe embedding in HTML. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Validate that a URL uses a safe scheme (http or https only). */
function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Tracking routes — no authentication required.
 * These use unique tracking tokens embedded in email links.
 */
export default async function trackingRoutes(fastify: FastifyInstance) {
  // GET /t/o/:token — Open tracking pixel
  fastify.get<{ Params: { token: string } }>(
    '/t/o/:token',
    async (request, reply) => {
      const { pixel } = await trackingService.processOpen(
        request.params.token,
        request.ip,
        request.headers['user-agent'],
      );

      return reply
        .type('image/gif')
        .header('Cache-Control', 'no-store, no-cache, must-revalidate')
        .header('Pragma', 'no-cache')
        .send(pixel);
    },
  );

  // GET /t/c/:token — Click tracking redirect
  fastify.get<{ Params: { token: string }; Querystring: { url?: string } }>(
    '/t/c/:token',
    async (request, reply) => {
      const url = request.query.url;

      // Validate the redirect URL uses a safe scheme — reject javascript:, data:, vbscript:, etc.
      if (!url || !isSafeRedirectUrl(url)) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_REDIRECT_URL',
            message: 'Missing or invalid redirect URL. Only http and https URLs are allowed.',
          },
        });
      }

      const { redirect_url, valid } = await trackingService.processClick(
        request.params.token,
        url,
        request.ip,
        request.headers['user-agent'],
      );

      // If the tracking token is invalid, return 404 — do NOT redirect
      if (!valid) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Invalid tracking token.' },
        });
      }

      return reply.redirect(redirect_url, 302);
    },
  );

  // GET /unsub/:token — Render unsubscribe confirmation page
  fastify.get<{ Params: { token: string } }>(
    '/unsub/:token',
    async (request, reply) => {
      try {
        const info = await trackingService.getUnsubscribeInfo(request.params.token);
        const safeEmail = escapeHtml(info.email);
        const safeToken = encodeURIComponent(request.params.token);
        const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Unsubscribe</title>
<style>body{font-family:system-ui;max-width:480px;margin:80px auto;text-align:center;color:#333}
button{background:#dc2626;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer}
button:hover{background:#b91c1c}</style></head>
<body>
<h1>Unsubscribe</h1>
<p>Click below to unsubscribe <strong>${safeEmail}</strong> from future email campaigns.</p>
<form method="POST" action="/unsub/${safeToken}">
  <button type="submit">Confirm Unsubscribe</button>
</form>
</body></html>`;
        return reply.type('text/html').send(html);
      } catch {
        return reply.type('text/html').send('<html><body><h1>Invalid Link</h1><p>This unsubscribe link is no longer valid.</p></body></html>');
      }
    },
  );

  // POST /unsub/:token — Process unsubscribe
  fastify.post<{ Params: { token: string } }>(
    '/unsub/:token',
    async (request, reply) => {
      const reason = (request.body as { reason?: string } | null)?.reason;
      const result = await trackingService.processUnsubscribe(
        request.params.token,
        reason,
      );

      const safeEmail = escapeHtml(result.email);
      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Unsubscribed</title>
<style>body{font-family:system-ui;max-width:480px;margin:80px auto;text-align:center;color:#333}</style></head>
<body>
<h1>You have been unsubscribed</h1>
<p><strong>${safeEmail}</strong> will no longer receive email campaigns from us.</p>
</body></html>`;
      return reply.type('text/html').send(html);
    },
  );
}
