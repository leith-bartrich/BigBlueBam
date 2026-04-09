import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
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

/**
 * Webhook routes for inbound SMTP provider notifications.
 * These would typically be secured via webhook signing secrets
 * in production (e.g., Postmark, SES, Mailgun signatures).
 */
export default async function webhookRoutes(fastify: FastifyInstance) {
  // POST /webhooks/bounce
  fastify.post(
    '/webhooks/bounce',
    async (request, reply) => {
      const body = bounceSchema.parse(request.body);
      const result = await webhookService.processBounce(body);
      return reply.send({ data: result });
    },
  );

  // POST /webhooks/complaint
  fastify.post(
    '/webhooks/complaint',
    async (request, reply) => {
      const body = complaintSchema.parse(request.body);
      const result = await webhookService.processComplaint(body);
      return reply.send({ data: result });
    },
  );
}
