/**
 * Internal LLM chat proxy for service-to-service calls.
 *
 * Bolt-api (and potentially other internal services) call
 * POST /internal/llm/chat to proxy chat completion requests through
 * the Bam API, which holds the encrypted LLM provider API keys.
 *
 * Auth: x-internal-secret header OR x-internal-token (reuses the
 * same INTERNAL_HELPDESK_SECRET for simplicity; both bolt-api and
 * helpdesk-api share the secret via INTERNAL_SERVICE_SECRET env var).
 *
 * Mount prefix: /internal/llm
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { llmProviders } from '../db/schema/llm-providers.js';
import { decryptApiKey } from '../services/llm-provider.service.js';
import { env } from '../env.js';
import { timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Internal auth guard (accepts x-internal-secret or x-internal-token)
// ---------------------------------------------------------------------------

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

async function requireInternalAuth(
  request: import('fastify').FastifyRequest,
  reply: import('fastify').FastifyReply,
) {
  // Accept either header name so bolt-api (x-internal-secret) and
  // helpdesk-api (x-internal-token) can both call this endpoint.
  const secretHeader = request.headers['x-internal-secret'];
  const tokenHeader = request.headers['x-internal-token'];
  const provided = (
    Array.isArray(secretHeader) ? secretHeader[0] : secretHeader
  ) ?? (
    Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader
  );

  if (!provided || typeof provided !== 'string') {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing internal service token',
        details: [],
        request_id: request.id,
      },
    });
  }

  // Check against both secrets (INTERNAL_SERVICE_SECRET is optional)
  const secrets = [env.INTERNAL_HELPDESK_SECRET];
  if (env.INTERNAL_SERVICE_SECRET) {
    secrets.push(env.INTERNAL_SERVICE_SECRET);
  }

  const matched = secrets.some((s) => timingSafeStringEqual(provided, s));
  if (!matched) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid internal service token',
        details: [],
        request_id: request.id,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const chatRequestSchema = z.object({
  provider_id: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    }),
  ).min(1),
  model: z.string().max(200).optional(),
  max_tokens: z.number().int().positive().max(100000).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export default async function internalLlmRoutes(fastify: FastifyInstance) {
  /**
   * POST /internal/llm/chat
   *
   * Resolves the provider by ID, decrypts the API key, and proxies
   * a chat completion request to the upstream LLM (Anthropic or
   * OpenAI-compatible). Returns `{ data: { content } }`.
   */
  fastify.post(
    '/chat',
    { preHandler: [requireInternalAuth] },
    async (request, reply) => {
      const body = chatRequestSchema.parse(request.body);

      // Fetch the provider row (raw, with encrypted key)
      const [provider] = await db
        .select()
        .from(llmProviders)
        .where(
          and(
            eq(llmProviders.id, body.provider_id),
            eq(llmProviders.enabled, true),
          ),
        )
        .limit(1);

      if (!provider) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'LLM provider not found or is disabled',
            details: [],
            request_id: request.id,
          },
        });
      }

      let apiKey: string;
      try {
        apiKey = decryptApiKey(provider.api_key_encrypted);
      } catch {
        request.log.error(
          { providerId: provider.id },
          'internal-llm: failed to decrypt provider API key',
        );
        return reply.status(500).send({
          error: {
            code: 'DECRYPTION_ERROR',
            message: 'Failed to decrypt the LLM provider API key',
            details: [],
            request_id: request.id,
          },
        });
      }

      const model = body.model ?? provider.model_id;
      const maxTokens = body.max_tokens ?? provider.max_tokens ?? 4096;
      const temperature = body.temperature ?? (provider.temperature != null ? Number(provider.temperature) : 0.7);

      try {
        if (provider.provider_type === 'anthropic') {
          const endpoint = provider.api_endpoint || 'https://api.anthropic.com';
          const response = await fetch(`${endpoint}/v1/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: maxTokens,
              messages: body.messages.filter((m) => m.role !== 'system'),
              ...(body.messages.some((m) => m.role === 'system')
                ? { system: body.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n') }
                : {}),
              temperature,
            }),
            signal: AbortSignal.timeout(60000),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            request.log.warn(
              { status: response.status, body: errText.slice(0, 500) },
              'internal-llm: upstream Anthropic error',
            );
            return reply.status(502).send({
              error: {
                code: 'UPSTREAM_ERROR',
                message: `LLM provider returned HTTP ${response.status}`,
                details: [],
                request_id: request.id,
              },
            });
          }

          const result = await response.json() as {
            content?: Array<{ type: string; text?: string }>;
          };
          const text = result.content?.find((c) => c.type === 'text')?.text ?? '';

          return reply.send({ data: { content: text } });
        } else {
          // OpenAI or OpenAI-compatible
          const endpoint = provider.api_endpoint || 'https://api.openai.com';
          const response = await fetch(`${endpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              max_tokens: maxTokens,
              messages: body.messages,
              temperature,
            }),
            signal: AbortSignal.timeout(60000),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            request.log.warn(
              { status: response.status, body: errText.slice(0, 500) },
              'internal-llm: upstream OpenAI-compatible error',
            );
            return reply.status(502).send({
              error: {
                code: 'UPSTREAM_ERROR',
                message: `LLM provider returned HTTP ${response.status}`,
                details: [],
                request_id: request.id,
              },
            });
          }

          const result = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const text = result.choices?.[0]?.message?.content ?? '';

          return reply.send({ data: { content: text } });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        request.log.error({ err }, 'internal-llm: proxy call failed');
        return reply.status(502).send({
          error: {
            code: 'UPSTREAM_ERROR',
            message: `LLM proxy call failed: ${message}`,
            details: [],
            request_id: request.id,
          },
        });
      }
    },
  );
}
