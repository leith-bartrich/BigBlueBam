import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';
import { postActivityFeedMessage } from '../services/activity-feed.js';
import { writeTranscriptSegment } from '../services/transcription.js';

const feedMessageSchema = z.object({
  org_id: z.string().uuid(),
  channel_slug: z.string().min(1).max(80),
  event_type: z.string().min(1).max(100),
  message: z.string().min(1).max(4000),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Middleware that verifies X-Internal-Secret header against INTERNAL_SERVICE_SECRET.
 * If the secret is not configured, logs a warning but allows the request (graceful degradation).
 */
async function requireInternalSecret(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const configuredSecret = env.INTERNAL_SERVICE_SECRET;

  if (!configuredSecret) {
    request.log.warn(
      'INTERNAL_SERVICE_SECRET is not configured — internal routes are unprotected. ' +
      'Set INTERNAL_SERVICE_SECRET env var (min 32 chars) to secure service-to-service calls.',
    );
    return;
  }

  const providedSecret = request.headers['x-internal-secret'] as string | undefined;

  const secretsMatch =
    providedSecret &&
    providedSecret.length === configuredSecret.length &&
    timingSafeEqual(Buffer.from(providedSecret), Buffer.from(configuredSecret));

  if (!secretsMatch) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing X-Internal-Secret header',
        details: [],
        request_id: request.id,
      },
    });
  }
}

/**
 * Internal API routes — called by other services (Bam API, worker) within the Docker network.
 * These endpoints require a shared service secret via X-Internal-Secret header.
 */
export default async function internalRoutes(fastify: FastifyInstance) {
  // POST /v1/internal/feed — post an activity feed message to a channel
  fastify.post(
    '/v1/internal/feed',
    { preHandler: [requireInternalSecret] },
    async (request, reply) => {
      const body = feedMessageSchema.parse(request.body);

      await postActivityFeedMessage({
        org_id: body.org_id,
        channel_slug: body.channel_slug,
        event_type: body.event_type,
        message: body.message,
        metadata: body.metadata,
      });

      return reply.send({ data: { success: true } });
    },
  );

  // POST /v1/internal/share — share a Bam entity to a Banter channel
  fastify.post(
    '/v1/internal/share',
    { preHandler: [requireInternalSecret] },
    async (request, reply) => {
      const body = z
        .object({
          org_id: z.string().uuid(),
          channel_slug: z.string().min(1),
          entity_type: z.string(), // 'task', 'sprint', 'ticket', 'project'
          entity_id: z.string(),
          entity_title: z.string(),
          shared_by_name: z.string(),
          entity_url: z.string().optional(),
        })
        .parse(request.body);

      const entityLabel = body.entity_type.charAt(0).toUpperCase() + body.entity_type.slice(1);
      const message = `**${body.shared_by_name}** shared a ${entityLabel}: **${body.entity_title}**${body.entity_url ? ` — [View in Bam](${body.entity_url})` : ''}`;

      await postActivityFeedMessage({
        org_id: body.org_id,
        channel_slug: body.channel_slug,
        event_type: `bbb.${body.entity_type}.shared`,
        message,
        metadata: {
          entity_type: body.entity_type,
          entity_id: body.entity_id,
        },
      });

      return reply.send({ data: { success: true } });
    },
  );

  // POST /v1/internal/transcript — receive a transcript segment from the voice agent
  fastify.post(
    '/v1/internal/transcript',
    { preHandler: [requireInternalSecret] },
    async (request, reply) => {
      const body = z
        .object({
          call_id: z.string().uuid(),
          speaker_id: z.string().uuid(),
          content: z.string().min(1),
          started_at: z.string().datetime(),
          ended_at: z.string().datetime().optional(),
          confidence: z.number().min(0).max(1).optional(),
          is_final: z.boolean(),
        })
        .parse(request.body);

      await writeTranscriptSegment({
        call_id: body.call_id,
        speaker_id: body.speaker_id,
        content: body.content,
        started_at: new Date(body.started_at),
        ended_at: body.ended_at ? new Date(body.ended_at) : undefined,
        confidence: body.confidence,
        is_final: body.is_final,
      });

      return reply.send({ data: { success: true } });
    },
  );
}
