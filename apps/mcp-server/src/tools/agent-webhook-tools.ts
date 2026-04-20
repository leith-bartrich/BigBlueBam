import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { registerTool } from '../lib/register-tool.js';

/**
 * Agent webhook MCP tools (AGENTIC_TODO §20, Wave 5).
 *
 * Tools:
 *   - agent_webhook_configure         POST /v1/agent-runners/:id/webhook
 *   - agent_webhook_rotate_secret     POST /v1/agent-runners/:id/webhook/rotate
 *   - agent_webhook_deliveries_list   GET  /v1/agent-webhook-deliveries
 *   - agent_webhook_redeliver         POST /v1/agent-webhook-deliveries/:id/redeliver
 *
 * The configure and rotate_secret tools return a plaintext secret that
 * is displayed to the operator exactly once. Callers that miss the
 * return value must rotate to obtain a new secret; there is no
 * "re-reveal".
 */

export function registerAgentWebhookTools(server: McpServer, api: ApiClient): void {
  registerTool(server, {
    name: 'agent_webhook_configure',
    description:
      "Configure or reconfigure an agent runner's outbound webhook. Accepts the target URL, an event_filter list (entries shaped like 'source:event_type' or 'source:*' or a single '*'), and an optional enabled flag (default true). Generates a fresh HMAC signing secret, hashes it with argon2id for server-side storage, and returns the plaintext secret exactly once; subsequent calls require rotation. Rejects URLs that would hit private/loopback/link-local IPs, cloud metadata endpoints, or *.internal hosts, and requires https in production. Resets webhook_consecutive_failures so a reconfigure lifts any circuit-breaker auto-disable.",
    input: {
      runner_user_id: z
        .string()
        .uuid()
        .describe("Agent/service user id whose runner row owns the webhook. Must be in the caller's active org."),
      webhook_url: z
        .string()
        .url()
        .max(2048)
        .describe('Target URL. https:// is required in production; http:// is allowed in dev/test.'),
      event_filter: z
        .array(z.string().min(1).max(200))
        .max(256)
        .describe(
          "List of event subscriptions. Entries: '*' (everything), 'bond:*' (any bond event), 'bond:deal.rotting' (exact match).",
        ),
      enabled: z
        .boolean()
        .optional()
        .describe('Whether the webhook is active after configure. Defaults true.'),
    },
    returns: z.object({
      data: z
        .object({
          runner_id: z.string().uuid(),
          webhook_url: z.string().url(),
          event_filter: z.array(z.string()),
          enabled: z.boolean(),
          plaintext_secret: z.string(),
          plaintext_notice: z.string(),
        })
        .passthrough(),
    }),
    handler: async ({ runner_user_id, webhook_url, event_filter, enabled }) => {
      const result = await api.post(
        `/v1/agent-runners/${runner_user_id}/webhook`,
        { webhook_url, event_filter, enabled },
      );
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error configuring webhook: ${JSON.stringify(result.data)}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  });

  registerTool(server, {
    name: 'agent_webhook_rotate_secret',
    description:
      "Rotate the HMAC signing secret for an agent runner's outbound webhook. Returns a fresh plaintext secret exactly once; the predecessor is invalidated atomically. Fails with WEBHOOK_NOT_CONFIGURED if the runner has no webhook_url yet (use agent_webhook_configure first). Unlike api-key rotation, there is no grace window: the next dispatch will be signed with the new secret, and receivers that cache the old secret will see signature mismatches until they swap.",
    input: {
      runner_user_id: z
        .string()
        .uuid()
        .describe("Agent/service user id whose runner row owns the webhook."),
    },
    returns: z.object({
      data: z
        .object({
          runner_id: z.string().uuid(),
          plaintext_secret: z.string(),
          plaintext_notice: z.string(),
        })
        .passthrough(),
    }),
    handler: async ({ runner_user_id }) => {
      const result = await api.post(
        `/v1/agent-runners/${runner_user_id}/webhook/rotate`,
        {},
      );
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error rotating webhook secret: ${JSON.stringify(result.data)}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  });

  registerTool(server, {
    name: 'agent_webhook_deliveries_list',
    description:
      "List recent webhook deliveries for the caller's active org. Filter by runner_id (limit to one runner), by status (pending | delivered | failed | dead_lettered), and paginate by passing the created_at of the last row as 'before'. Returns attempt_count, last_error, response_status_code, and timestamps so operators can triage failures and redeliver dead-lettered rows. Capped at 200 per call; default limit 50.",
    input: {
      runner_id: z
        .string()
        .uuid()
        .optional()
        .describe('Restrict to deliveries for a single runner.'),
      status: z
        .enum(['pending', 'delivered', 'failed', 'dead_lettered'])
        .optional()
        .describe('Filter by delivery state.'),
      before: z
        .string()
        .datetime()
        .optional()
        .describe('Paginate: pass the created_at of the oldest previously-returned row.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Max rows to return. Default 50, ceiling 200.'),
    },
    returns: z.object({
      data: z.array(
        z
          .object({
            id: z.string().uuid(),
            runner_id: z.string().uuid(),
            event_id: z.string().uuid(),
            event_source: z.string(),
            event_type: z.string(),
            status: z.string(),
            attempt_count: z.number().int().nonnegative(),
            response_status_code: z.number().int().nullable(),
            last_error: z.string().nullable(),
            created_at: z.string(),
            delivered_at: z.string().nullable(),
            next_retry_at: z.string().nullable(),
          })
          .passthrough(),
      ),
    }),
    handler: async ({ runner_id, status, before, limit }) => {
      const params = new URLSearchParams();
      if (runner_id) params.set('runner_id', runner_id);
      if (status) params.set('status', status);
      if (before) params.set('before', before);
      if (limit !== undefined) params.set('limit', String(limit));
      const qs = params.toString();
      const result = await api.get(`/v1/agent-webhook-deliveries${qs ? `?${qs}` : ''}`);
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error listing webhook deliveries: ${JSON.stringify(result.data)}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  });

  registerTool(server, {
    name: 'agent_webhook_redeliver',
    description:
      "Re-enqueue a specific webhook delivery. Resets attempt_count to 0 and status to pending, then queues a fresh dispatcher job. Useful for reviving dead-lettered rows after the operator has fixed the receiver, or for forcing a retry on a pending row without waiting for the backoff to elapse. Fails with RUNNER_WEBHOOK_DISABLED if the runner's webhook has been auto-disabled by the circuit breaker; reconfigure or re-enable the runner first.",
    input: {
      delivery_id: z
        .string()
        .uuid()
        .describe('Target delivery row id from agent_webhook_deliveries_list.'),
    },
    returns: z.object({
      data: z
        .object({
          id: z.string().uuid(),
          status: z.literal('pending'),
          enqueued_job_id: z.string(),
        })
        .passthrough(),
    }),
    handler: async ({ delivery_id }) => {
      const result = await api.post(
        `/v1/agent-webhook-deliveries/${delivery_id}/redeliver`,
        {},
      );
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error redelivering webhook: ${JSON.stringify(result.data)}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  });
}
