import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { betaSignupNotifications } from '../db/schema/beta-signup-notifications.js';
import { getPlatformSettings } from '../services/platform-settings.service.js';
import { isBootstrapRequired } from '../services/bootstrap-status.service.js';

/**
 * Unauthenticated public endpoints used by login/register pages.
 *
 *   GET /public/config       — public runtime flags (e.g. whether signup
 *                              is open). Cheap single-row read, so no
 *                              caching for now.
 *   POST /public/beta-signup — notify-me form submission. Rate-limited
 *                              via a simple per-IP throttle to discourage
 *                              spam.
 */

const betaSignupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().toLowerCase().email('Valid email is required').max(320),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  message: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

// Simple in-memory per-IP throttle: one submission per IP per 30s. Resets on
// process restart. Good enough to keep accidental double-clicks and trivial
// scripted floods out; real spam mitigation would need a worker + captcha.
const RECENT_SUBMISSIONS = new Map<string, number>();
const THROTTLE_MS = 30_000;

function truncate(s: unknown, max: number): string | null {
  if (typeof s !== 'string' || s.length === 0) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export default async function publicConfigRoutes(fastify: FastifyInstance) {
  fastify.get('/public/config', async () => {
    const settings = await getPlatformSettings();
    const bootstrapRequired = await isBootstrapRequired();
    return {
      data: {
        public_signup_disabled: settings.public_signup_disabled === true,
        bootstrap_required: bootstrapRequired,
      },
    };
  });

  fastify.post('/public/beta-signup', async (request, reply) => {
    const parsed = betaSignupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid form submission',
          details: parsed.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
          request_id: request.id,
        },
      });
    }

    const ip = request.ip || 'unknown';
    const now = Date.now();
    const last = RECENT_SUBMISSIONS.get(ip);
    if (last && now - last < THROTTLE_MS) {
      return reply.status(429).send({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Please wait a moment before submitting again.',
          request_id: request.id,
        },
      });
    }
    RECENT_SUBMISSIONS.set(ip, now);
    // Opportunistic cleanup of stale entries so the map doesn't grow.
    if (RECENT_SUBMISSIONS.size > 1000) {
      for (const [k, t] of RECENT_SUBMISSIONS.entries()) {
        if (now - t > THROTTLE_MS) RECENT_SUBMISSIONS.delete(k);
      }
    }

    await db.insert(betaSignupNotifications).values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      message: parsed.data.message,
      ip_address: ip,
      user_agent: truncate(request.headers['user-agent'], 512),
    });

    return reply.status(201).send({ data: { ok: true } });
  });
}
