import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import * as webhookService from '../services/webhook.service.js';

const bounceSchema = z.object({
  message_id: z.string().optional(),
  email: z.string().email().optional(),
  bounce_type: z.enum(['hard', 'soft', 'complaint']),
  reason: z.string().optional(),
});

const complaintSchema = z.object({
  message_id: z.string().optional(),
  email: z.string().email().optional(),
});

let webhookSecretWarningLogged = false;

/**
 * Validate the X-Webhook-Secret header if BLAST_WEBHOOK_SECRET is configured.
 * If the env var is not set, log a warning (once) and allow the request through
 * for graceful degradation on existing deployments.
 */
async function validateWebhookSecret(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const configuredSecret = env.BLAST_WEBHOOK_SECRET;

  if (!configuredSecret) {
    if (!webhookSecretWarningLogged) {
      request.log.warn(
        'BLAST_WEBHOOK_SECRET is not configured — webhook endpoints are unauthenticated. ' +
        'Set this env var to secure inbound webhooks.',
      );
      webhookSecretWarningLogged = true;
    }
    return;
  }

  const provided = request.headers['x-webhook-secret'];
  if (!provided || provided !== configuredSecret) {
    return reply.status(401).send({
      error: {
        code: 'WEBHOOK_AUTH_FAILED',
        message: 'Invalid or missing X-Webhook-Secret header.',
      },
    });
  }
}

/**
 * Webhook routes for inbound SMTP provider notifications.
 * Secured via X-Webhook-Secret header when BLAST_WEBHOOK_SECRET is configured.
 * Rate-limited to prevent abuse.
 */
export default async function webhookRoutes(fastify: FastifyInstance) {
  // POST /webhooks/bounce
  fastify.post(
    '/webhooks/bounce',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      preHandler: [validateWebhookSecret],
    },
    async (request, reply) => {
      const body = bounceSchema.parse(request.body);
      const result = await webhookService.processBounce(body);
      return reply.send({ data: result });
    },
  );

  // POST /webhooks/complaint
  fastify.post(
    '/webhooks/complaint',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      preHandler: [validateWebhookSecret],
    },
    async (request, reply) => {
      const body = complaintSchema.parse(request.body);
      const result = await webhookService.processComplaint(body);
      return reply.send({ data: result });
    },
  );
}
