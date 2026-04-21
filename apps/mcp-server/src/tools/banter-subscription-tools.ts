// §1 Wave 5 banter subs - MCP tools for pattern subscriptions.
//
//   banter_subscribe_pattern({ channel_id, pattern, rate_limit_per_hour? })
//     -> { subscription_id, effective, reason? }
//
//   banter_unsubscribe_pattern({ subscription_id })
//     -> { subscription_id, disabled_at }
//
//   banter_list_subscriptions({ channel_id? })
//     -> { data: subscription[] }
//
// All three wrap the banter-api routes in agent-subscriptions.routes.ts.
// The MCP layer's job is translate-and-forward; write gates + evaluator
// live server-side so a rogue caller can't bypass the agent policy.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { registerTool } from '../lib/register-tool.js';

interface BanterRequestResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

function makeBanterClient(banterApiUrl: string, api: ApiClient) {
  const baseUrl = banterApiUrl.replace(/\/$/, '');
  const token = (api as unknown as { token?: string }).token;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<BanterRequestResult<T>> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    try {
      const res = await fetch(`${baseUrl}${path}`, init);
      const data = (await res.json()) as T;
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        data: {
          error: err instanceof Error ? err.message : 'Unknown error',
        } as unknown as T,
      };
    }
  }

  return {
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    get: <T>(path: string) => request<T>('GET', path),
    del: <T>(path: string) => request<T>('DELETE', path),
  };
}

// Pattern schemas. A discriminated union per kind so the MCP JSON-Schema
// surface is typed and the LLM receives enum hints.
const patternInterrogativeSchema = z.object({
  kind: z.literal('interrogative'),
});

const patternKeywordSchema = z.object({
  kind: z.literal('keyword'),
  terms: z.array(z.string().min(1).max(200)).min(1).max(50),
  mode: z.enum(['any', 'all']).optional(),
  case_sensitive: z.boolean().optional(),
});

const patternRegexSchema = z.object({
  kind: z.literal('regex'),
  pattern: z.string().min(1).max(512),
  flags: z.string().max(8).optional(),
});

const patternMentionSchema = z.object({
  kind: z.literal('mention'),
  user_id: z.string().uuid(),
  display_name: z.string().min(1).max(100),
});

const patternSpecSchema = z.discriminatedUnion('kind', [
  patternInterrogativeSchema,
  patternKeywordSchema,
  patternRegexSchema,
  patternMentionSchema,
]);

export function registerBanterSubscriptionTools(
  server: McpServer,
  api: ApiClient,
  banterApiUrl: string,
): void {
  const banter = makeBanterClient(banterApiUrl, api);

  registerTool(server, {
    name: 'banter_subscribe_pattern',
    description:
      "Create a passive pattern subscription on a Banter channel. Fires banter.message.matched Bolt events whenever an incoming message matches the supplied pattern_spec. Pattern kinds: 'interrogative' (any question-shaped message), 'keyword' (term list with any/all mode), 'regex' (ADMIN-ONLY to mitigate ReDoS), 'mention' (matches @display_name substrings). Subscriber defaults to the caller, who must be users.kind IN ('agent','service'). Returns subscription_id plus effective=false with a reason string when the channel policy or §15 agent_policies blocks routing - the row is still stored so operators can see the intent.",
    input: {
      channel_id: z.string().uuid().describe('Target channel UUID'),
      subscriber_user_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          'Agent/service user id for whom to create the subscription. Defaults to the caller.',
        ),
      pattern: patternSpecSchema.describe(
        "Pattern spec. One of: {kind:'interrogative'}, {kind:'keyword', terms:[], mode?:'any'|'all', case_sensitive?:bool}, {kind:'regex', pattern:string, flags?:string} (admin-only), {kind:'mention', user_id:uuid, display_name:string}.",
      ),
      rate_limit_per_hour: z
        .number()
        .int()
        .min(1)
        .max(3600)
        .optional()
        .describe(
          'Per-subscription hourly match ceiling before the worker drops further matches until the next hour. Default 30. Also bounded by the per-subscriber ceiling (default 300).',
        ),
    },
    returns: z.object({
      data: z
        .object({
          subscription_id: z.string().uuid(),
          effective: z.boolean(),
          reason: z.string().optional(),
        })
        .passthrough(),
    }),
    handler: async ({ channel_id, pattern, subscriber_user_id, rate_limit_per_hour }) => {
      const body: Record<string, unknown> = { pattern };
      if (subscriber_user_id !== undefined) body.subscriber_user_id = subscriber_user_id;
      if (rate_limit_per_hour !== undefined) body.rate_limit_per_hour = rate_limit_per_hour;

      const result = await banter.post(
        `/v1/channels/${channel_id}/agent-subscriptions`,
        body,
      );
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error subscribing pattern: ${JSON.stringify(result.data)}`,
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
    name: 'banter_unsubscribe_pattern',
    description:
      "Disable an existing pattern subscription. Idempotent: re-calling on an already-disabled row returns the original disabled_at. Only the subscriber (or a SuperUser) can disable via this path; channel admins wanting to force-unsubscribe an agent should use the channel admin surface.",
    input: {
      subscription_id: z.string().uuid(),
    },
    returns: z.object({
      data: z
        .object({
          subscription_id: z.string().uuid(),
          disabled_at: z.string(),
        })
        .passthrough(),
    }),
    handler: async ({ subscription_id }) => {
      const result = await banter.del(`/v1/agent-subscriptions/${subscription_id}`);
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error unsubscribing pattern: ${JSON.stringify(result.data)}`,
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
    name: 'banter_list_subscriptions',
    description:
      "List the caller's active pattern subscriptions. Pass channel_id to restrict to a single channel. Returns up to 200 rows ordered by created_at desc.",
    input: {
      channel_id: z
        .string()
        .uuid()
        .optional()
        .describe('Restrict the list to a single channel.'),
    },
    returns: z.object({
      data: z.array(
        z
          .object({
            id: z.string().uuid(),
            channel_id: z.string().uuid(),
            pattern_spec: z.unknown(),
            rate_limit_per_hour: z.number().int(),
            match_count: z.number().int(),
            last_matched_at: z.string().nullable(),
            opted_in_at: z.string(),
            created_at: z.string(),
          })
          .passthrough(),
      ),
    }),
    handler: async ({ channel_id }) => {
      const qs = channel_id ? `?channel_id=${encodeURIComponent(channel_id)}` : '';
      const result = await banter.get(`/v1/agent-subscriptions${qs}`);
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error listing subscriptions: ${JSON.stringify(result.data)}`,
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
