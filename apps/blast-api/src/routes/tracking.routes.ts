import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as trackingService from '../services/tracking.service.js';

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
      const url = request.query.url ?? '/';
      const { redirect_url } = await trackingService.processClick(
        request.params.token,
        url,
        request.ip,
        request.headers['user-agent'],
      );

      return reply.redirect(302, redirect_url);
    },
  );

  // GET /unsub/:token — Render unsubscribe confirmation page
  fastify.get<{ Params: { token: string } }>(
    '/unsub/:token',
    async (request, reply) => {
      try {
        const info = await trackingService.getUnsubscribeInfo(request.params.token);
        const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Unsubscribe</title>
<style>body{font-family:system-ui;max-width:480px;margin:80px auto;text-align:center;color:#333}
button{background:#dc2626;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer}
button:hover{background:#b91c1c}</style></head>
<body>
<h1>Unsubscribe</h1>
<p>Click below to unsubscribe <strong>${info.email}</strong> from future email campaigns.</p>
<form method="POST" action="/unsub/${request.params.token}">
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

      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Unsubscribed</title>
<style>body{font-family:system-ui;max-width:480px;margin:80px auto;text-align:center;color:#333}</style></head>
<body>
<h1>You have been unsubscribed</h1>
<p><strong>${result.email}</strong> will no longer receive email campaigns from us.</p>
</body></html>`;
      return reply.type('text/html').send(html);
    },
  );
}
