// §1 Wave 5 banter subs - HTTP routes for agent pattern subscriptions.
//
//   POST   /v1/channels/:id/agent-subscriptions   create subscription
//   DELETE /v1/agent-subscriptions/:sid           disable subscription
//   GET    /v1/agent-subscriptions                list caller's own subs
//   GET    /v1/channels/:id/agent-subscriptions   list subs on a channel
//                                                  (org admin / channel admin)
//
// These are wrapped by the MCP banter_subscribe_pattern /
// banter_unsubscribe_pattern / banter_list_subscriptions tools in
// apps/mcp-server/src/tools/banter-subscription-tools.ts.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireChannelMember, requireChannelAdmin } from '../middleware/channel-auth.js';
import {
  AgentSubscriptionError,
  createSubscription,
  disableSubscription,
  listSubscriptionsForSubscriber,
  listActiveSubscriptionsForChannel,
  validatePatternSpec,
} from '../services/agent-subscriptions.service.js';

const subscribeBodySchema = z.object({
  subscriber_user_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Which agent/service user the subscription belongs to. Defaults to the caller, which must itself be kind=agent|service.',
    ),
  pattern: z.record(z.unknown()),
  rate_limit_per_hour: z.number().int().min(1).max(3600).optional(),
});

function mapSubscriptionError(err: unknown): { status: number; body: unknown } {
  if (err instanceof AgentSubscriptionError) {
    const codeToStatus: Record<string, number> = {
      NOT_FOUND: 404,
      NOT_AN_AGENT: 400,
      CROSS_ORG: 403,
      FORBIDDEN: 403,
      REGEX_ADMIN_ONLY: 403,
    };
    const status = codeToStatus[err.code] ?? 400;
    return {
      status,
      body: {
        error: { code: err.code, message: err.message, details: [] },
      },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
        details: [],
      },
    },
  };
}

export default async function agentSubscriptionsRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/v1/channels/:id/agent-subscriptions',
    { preHandler: [requireAuth, requireScope('read_write'), requireChannelMember] },
    async (request, reply) => {
      const user = request.user!;
      const { id: channelId } = request.params as { id: string };
      const parsed = subscribeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid subscription body',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              issue: i.message,
            })),
            request_id: request.id,
          },
        });
      }
      const body = parsed.data;

      // Default subscriber to caller. This allows a service account using
      // its own bbam_svc_ key to subscribe itself in one call.
      const subscriberUserId = body.subscriber_user_id ?? user.id;

      const specValidation = validatePatternSpec(body.pattern);
      if (!specValidation.ok) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_PATTERN',
            message: specValidation.reason,
            details: [],
            request_id: request.id,
          },
        });
      }

      try {
        const result = await createSubscription({
          subscriber_user_id: subscriberUserId,
          channel_id: channelId,
          org_id: user.org_id,
          opted_in_by: user.id,
          opted_in_by_role: user.role,
          pattern: specValidation.spec,
          rate_limit_per_hour: body.rate_limit_per_hour,
        });
        return reply.status(201).send({ data: result });
      } catch (err) {
        const mapped = mapSubscriptionError(err);
        request.log.warn({ err }, 'agent subscription create failed');
        return reply.status(mapped.status).send(mapped.body);
      }
    },
  );

  fastify.delete(
    '/v1/agent-subscriptions/:sid',
    { preHandler: [requireAuth, requireScope('read_write')] },
    async (request, reply) => {
      const user = request.user!;
      const { sid } = request.params as { sid: string };
      try {
        const result = await disableSubscription(
          sid,
          user.id,
          user.org_id,
          user.is_superuser,
        );
        return reply.send({
          data: {
            subscription_id: result.subscription_id,
            disabled_at: result.disabled_at.toISOString(),
          },
        });
      } catch (err) {
        const mapped = mapSubscriptionError(err);
        return reply.status(mapped.status).send(mapped.body);
      }
    },
  );

  fastify.get(
    '/v1/agent-subscriptions',
    { preHandler: [requireAuth, requireScope('read')] },
    async (request, reply) => {
      const user = request.user!;
      const query = request.query as { channel_id?: string };
      const rows = await listSubscriptionsForSubscriber(
        user.id,
        user.org_id,
        query.channel_id,
      );
      return reply.send({
        data: rows.map((r) => ({
          id: r.id,
          org_id: r.org_id,
          subscriber_user_id: r.subscriber_user_id,
          channel_id: r.channel_id,
          pattern_spec: r.pattern_spec,
          rate_limit_per_hour: r.rate_limit_per_hour,
          match_count: r.match_count,
          last_matched_at: r.last_matched_at?.toISOString() ?? null,
          opted_in_at: r.opted_in_at.toISOString(),
          created_at: r.created_at.toISOString(),
        })),
      });
    },
  );

  // Channel-scoped "who is listening here?" view. Gated on channel admin
  // so regular members can't see every subscription, but org admins can.
  fastify.get(
    '/v1/channels/:id/agent-subscriptions',
    { preHandler: [requireAuth, requireScope('read'), requireChannelMember, requireChannelAdmin] },
    async (request, reply) => {
      const { id: channelId } = request.params as { id: string };
      const rows = await listActiveSubscriptionsForChannel(channelId);
      return reply.send({
        data: rows.map((r) => ({
          id: r.id,
          org_id: r.org_id,
          subscriber_user_id: r.subscriber_user_id,
          channel_id: r.channel_id,
          pattern_spec: r.pattern_spec,
          rate_limit_per_hour: r.rate_limit_per_hour,
          match_count: r.match_count,
          last_matched_at: r.last_matched_at?.toISOString() ?? null,
          opted_in_at: r.opted_in_at.toISOString(),
          created_at: r.created_at.toISOString(),
        })),
      });
    },
  );
}
