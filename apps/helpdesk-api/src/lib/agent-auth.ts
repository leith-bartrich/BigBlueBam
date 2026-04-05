import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { helpdeskAgentApiKeys } from '../db/schema/helpdesk-agent-api-keys.js';
import { users } from '../db/schema/bbb-refs.js';

/**
 * Verify a per-agent helpdesk API key (HB-28 + HB-49).
 *
 * Extracted for reuse across helpdesk routes that need agent-grade
 * authentication without pulling in the full preHandler from
 * agent.routes.ts. Matches the verification semantics of
 * `requireAgentAuth` there:
 *
 *  - Token MUST be supplied via X-Agent-Key (Bearer collides with
 *    end-customer JWTs on other helpdesk routes).
 *  - Token prefix (first 8 chars) indexes into helpdesk_agent_api_keys;
 *    full token is Argon2id-verified against key_hash.
 *  - DoS mitigation: cap candidate verifications if a prefix has >3
 *    candidates (natural prefix collisions are vanishingly rare with
 *    an 8-char random prefix).
 *  - Always run argon2.verify before checking revoked/expired so timing
 *    doesn't leak whether a prefix corresponds to a live key.
 *
 * Returns the BBB user_id owning the key on success, or null on any
 * verification failure. Callers are responsible for translating null
 * into an HTTP response.
 */
export async function verifyAgentApiKey(
  request: FastifyRequest,
  token: string | undefined,
): Promise<string | null> {
  if (!token || token.length < 9) return null;

  const prefix = token.slice(0, 8);

  const candidates = await db
    .select({
      id: helpdeskAgentApiKeys.id,
      bbb_user_id: helpdeskAgentApiKeys.bbb_user_id,
      key_hash: helpdeskAgentApiKeys.key_hash,
      expires_at: helpdeskAgentApiKeys.expires_at,
      revoked_at: helpdeskAgentApiKeys.revoked_at,
      user_is_active: users.is_active,
    })
    .from(helpdeskAgentApiKeys)
    .innerJoin(users, eq(users.id, helpdeskAgentApiKeys.bbb_user_id))
    .where(eq(helpdeskAgentApiKeys.key_prefix, prefix))
    .limit(10);

  const verifyCandidates = candidates.length > 3 ? candidates.slice(0, 1) : candidates;
  if (candidates.length > 3) {
    request.log.warn(
      { prefix, candidate_count: candidates.length },
      'Suspicious number of helpdesk agent key candidates for prefix; limiting to first candidate',
    );
  }

  const now = new Date();
  for (const candidate of verifyCandidates) {
    // A malformed stored hash throws; treat that as a verification
    // failure so one corrupt row can't 500 every request that happens
    // to share its prefix.
    let valid = false;
    try {
      valid = await argon2.verify(candidate.key_hash, token);
    } catch (err) {
      request.log.warn({ err, candidate_id: candidate.id }, 'argon2.verify threw on agent key candidate; treating as invalid');
    }
    if (!valid) continue;
    if (candidate.revoked_at && new Date(candidate.revoked_at) <= now) continue;
    if (candidate.expires_at && new Date(candidate.expires_at) <= now) continue;
    if (!candidate.user_is_active) continue;

    // Fire-and-forget last_used_at update — don't block the response.
    db.update(helpdeskAgentApiKeys)
      .set({ last_used_at: now })
      .where(eq(helpdeskAgentApiKeys.id, candidate.id))
      .catch((err) => {
        request.log.warn({ err }, 'Failed to update helpdesk_agent_api_keys.last_used_at');
      });

    return candidate.bbb_user_id;
  }

  return null;
}

/**
 * Fastify preHandler that rejects requests without a valid per-agent
 * helpdesk API key. On success, does not touch the request (callers
 * that need the owning bbb_user_id should call verifyAgentApiKey
 * directly).
 */
export async function requireAgentAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers['x-agent-key'] as string | undefined;
  const userId = await verifyAgentApiKey(request, token);
  if (!userId) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: token ? 'Invalid agent API key' : 'Missing or malformed X-Agent-Key header',
        details: [],
        request_id: request.id,
      },
    });
  }
}
