import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq, desc, and, sql } from 'drizzle-orm';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { tickets } from '../db/schema/tickets.js';
import { ticketMessages } from '../db/schema/ticket-messages.js';
import { projects, users } from '../db/schema/bbb-refs.js';
import { helpdeskAgentApiKeys } from '../db/schema/helpdesk-agent-api-keys.js';
import {
  broadcastTicketMessage,
  broadcastTicketStatusChanged,
} from '../services/realtime.js';
import { mirrorTicketMessageToTask, mirrorTicketClosedToTask } from '../lib/task-sync.js';

const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  category: z.string().max(100).optional(),
});

const agentMessageSchema = z.object({
  body: z.string().min(1),
  is_internal: z.boolean().default(false),
  author_name: z.string().min(1).max(100).optional(),
  author_id: z.string().uuid().optional(),
});

/**
 * Identity resolved from an authenticated agent request.
 * `userId`/`orgId` are only populated if a valid BBB session cookie accompanied
 * the request (indicating a logged-in human agent). Even when a session is
 * present, a valid X-Agent-Key / Bearer token is still required for auth —
 * the session alone does NOT grant access (see HB-12).
 */
interface AgentIdentity {
  userId: string | null;
  userDisplayName: string | null;
  orgId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * BBB user id of the agent whose X-Agent-Key authenticated this
     * request. Populated by requireAgentAuth once the key is verified.
     * Distinct from the session-cookie-derived identity used for
     * org-scoping / message authorship: the key is the authoritative
     * authentication factor (HB-28 + HB-49), while the session cookie
     * is purely informational.
     */
    agentUserId: string | null;
  }
}

/**
 * Look up a BBB user + org from a session cookie. Returns null if the session
 * is missing, invalid, or expired. This is used ONLY to enrich the request
 * with caller identity (for org-scoping and authorship) — it is NOT an
 * authentication mechanism on its own (see HB-12).
 */
async function resolveSessionIdentity(sessionCookie: string | undefined): Promise<AgentIdentity | null> {
  if (!sessionCookie) return null;
  try {
    const result = await db.execute(
      sql`SELECT u.id AS user_id, u.display_name, u.org_id
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.id = ${sessionCookie} AND s.expires_at > now()
          LIMIT 1`,
    );
    const row = Array.isArray(result) ? result[0] : (result as any).rows?.[0];
    if (!row) return null;
    return {
      userId: (row as any).user_id ?? null,
      userDisplayName: (row as any).display_name ?? null,
      orgId: (row as any).org_id ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Verify the request has a valid per-agent API key (HB-28 + HB-49).
 *
 * Agents MUST present a token via the X-Agent-Key header (Bearer form is
 * NOT supported on this route, since Bearer collides with end-customer
 * JWTs on other helpdesk routes). The token is of the form
 * `hdag_<base64url>`; its first 8 chars are the key_prefix we index on,
 * and the full token is Argon2id-verified against the stored hash in
 * helpdesk_agent_api_keys.
 *
 * This used to accept a raw shared secret from env.AGENT_API_KEY with a
 * timing-safe string compare, and would also fall back to a BBB session
 * cookie alone (HB-49) — both removed here:
 *   - The shared secret had no audit trail, couldn't be rotated per-
 *     agent, and wasn't hashed at rest.
 *   - Session-cookie fallback meant any logged-in BBB end-user could
 *     call helpdesk agent endpoints with no role check against
 *     organization_memberships — a fragile cross-app auth surface.
 *
 * Per-agent rows give us a real audit trail (bbb_user_id on the key),
 * per-key rotation via revoked_at / expires_at, and Argon2id hashing at
 * rest matching the bbam_ API key model.
 */
async function requireAgentAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers['x-agent-key'] as string | undefined;

  if (!token || token.length < 9) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed X-Agent-Key header',
        details: [],
        request_id: request.id,
      },
    });
  }

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

  // DoS mitigation (same as apps/api/src/plugins/auth.ts): an 8-char
  // random prefix has ~2.8e14 combinations so natural collisions are
  // vanishingly rare. Seeing >3 candidates suggests an attacker is
  // trying to force multiple Argon2 verifications per request, so we
  // cap verification to the first candidate and log a warning.
  const verifyCandidates = candidates.length > 3 ? candidates.slice(0, 1) : candidates;
  if (candidates.length > 3) {
    request.log.warn(
      { prefix, candidate_count: candidates.length },
      'Suspicious number of helpdesk agent key candidates for prefix; limiting to first candidate',
    );
  }

  const now = new Date();
  for (const candidate of verifyCandidates) {
    // Always run argon2.verify BEFORE checking expiry/revoked so that
    // expired-but-valid-hash and invalid-hash keys take the same wall
    // time — otherwise short-circuiting would leak (via timing) whether
    // a given prefix corresponds to a real key.
    // A malformed stored hash (e.g. truncated column, bad migration)
    // causes argon2.verify to throw; treat that as a verification
    // failure so one corrupt row doesn't 500 every request sharing
    // its prefix.
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

    request.agentUserId = candidate.bbb_user_id;

    // Fire-and-forget last_used_at update — don't block the response on it.
    db.update(helpdeskAgentApiKeys)
      .set({ last_used_at: now })
      .where(eq(helpdeskAgentApiKeys.id, candidate.id))
      .catch((err) => {
        request.log.warn({ err }, 'Failed to update helpdesk_agent_api_keys.last_used_at');
      });

    return;
  }

  return reply.status(401).send({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Invalid agent API key',
      details: [],
      request_id: request.id,
    },
  });
}

/**
 * Resolve a display name for the agent who authenticated this request,
 * for attribution in mirrored BBB task comments (HB-50). Prefers the BBB
 * user's display_name, falling back to email, then a static label.
 * Best-effort — never throws.
 */
async function resolveAgentDisplayName(agentUserId: string | null): Promise<string> {
  if (!agentUserId) return 'Support Agent';
  try {
    const [row] = await db
      .select({ display_name: users.display_name, email: users.email })
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1);
    return row?.display_name ?? row?.email ?? 'Support Agent';
  } catch {
    return 'Support Agent';
  }
}

export default async function agentRoutes(fastify: FastifyInstance) {
  fastify.decorateRequest('agentUserId', null);


  // GET /tickets — list tickets visible to the caller (HB-6: org-scoped).
  //
  // Scoping model:
  //  - If the request carries a valid BBB session cookie, we scope tickets to
  //    the session user's org by joining tickets.project_id → projects.org_id.
  //    Tickets with no project_id (unlinked) are excluded from the scoped view.
  //  - If there is no session (X-Agent-Key only), we fall back to the current
  //    shared-key trust model and return all tickets. This is a KNOWN LIMITATION
  //    of the shared-key deployment: the X-Agent-Key is org-wide/global and
  //    helpdesk_users have no org_id column yet, so there is no reliable way
  //    to derive an org boundary from the key alone. Operators deploying the
  //    shared key to multi-tenant installs should either (a) run one helpdesk
  //    per org, or (b) always access via a BBB session.
  fastify.get('/tickets', { preHandler: [requireAgentAuth] }, async (request, reply) => {
    const query = request.query as { status?: string; project_id?: string };
    const identity = await resolveSessionIdentity(request.cookies?.session);
    const scopeOrgId = identity?.orgId ?? null;

    const conditions = [] as any[];
    if (query.status) conditions.push(eq(tickets.status, query.status));
    if (query.project_id) conditions.push(eq(tickets.project_id, query.project_id));

    let rows;
    if (scopeOrgId) {
      // Org-scoped: join through projects to filter by org.
      conditions.push(eq(projects.org_id, scopeOrgId));
      rows = await db
        .select({
          id: tickets.id,
          ticket_number: tickets.ticket_number,
          helpdesk_user_id: tickets.helpdesk_user_id,
          task_id: tickets.task_id,
          project_id: tickets.project_id,
          subject: tickets.subject,
          description: tickets.description,
          status: tickets.status,
          priority: tickets.priority,
          category: tickets.category,
          created_at: tickets.created_at,
          updated_at: tickets.updated_at,
          resolved_at: tickets.resolved_at,
          closed_at: tickets.closed_at,
        })
        .from(tickets)
        .innerJoin(projects, eq(projects.id, tickets.project_id))
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(tickets.updated_at));
    } else {
      // No session — shared-key trust model, return all tickets (see comment above).
      const whereClause =
        conditions.length === 0
          ? undefined
          : conditions.length === 1
            ? conditions[0]
            : and(...conditions);
      rows = whereClause
        ? await db.select().from(tickets).where(whereClause).orderBy(desc(tickets.updated_at))
        : await db.select().from(tickets).orderBy(desc(tickets.updated_at));
    }

    return reply.send({ data: rows });
  });

  // GET /tickets/:id — full ticket detail including internal messages
  fastify.get('/tickets/:id', { preHandler: [requireAgentAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, id))
      .limit(1);

    if (!ticket) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
          details: [],
          request_id: request.id,
        },
      });
    }

    // Include ALL messages (including internal)
    const messages = await db
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.ticket_id, id))
      .orderBy(ticketMessages.created_at);

    return reply.send({
      data: {
        ...ticket,
        messages,
      },
    });
  });

  // POST /tickets/:id/messages — agent posts a message
  fastify.post('/tickets/:id/messages', {
    preHandler: [requireAgentAuth],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = agentMessageSchema.parse(request.body);

    // Verify ticket exists
    const [ticket] = await db
      .select({ id: tickets.id, task_id: tickets.task_id })
      .from(tickets)
      .where(eq(tickets.id, id))
      .limit(1);

    if (!ticket) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
          details: [],
          request_id: request.id,
        },
      });
    }

    // HB-14: Resolve author identity from the authenticated session FIRST.
    // If a valid BBB session accompanies the request, the session's user ID
    // is authoritative — the client may NOT override it via author_id in the
    // body. If no session is present (X-Agent-Key only), the caller MUST
    // supply author_id AND that UUID must correspond to a real user row; we
    // also require the user to belong to the target ticket's org (derived
    // from the ticket's project). This prevents a holder of the shared agent
    // key from forging messages as arbitrary/non-existent users.
    const identity = await resolveSessionIdentity(request.cookies?.session);

    let authorId: string;
    let authorName: string;

    if (identity?.userId) {
      // Session-authenticated human agent — identity is server-determined.
      authorId = identity.userId;
      authorName = data.author_name ?? identity.userDisplayName ?? 'Support Agent';
    } else {
      // X-Agent-Key only: require explicit, validated author_id.
      if (!data.author_id) {
        return reply.status(400).send({
          error: {
            code: 'AUTHOR_REQUIRED',
            message: 'author_id is required when not authenticated via a BBB session',
            details: [{ field: 'author_id', issue: 'required' }],
            request_id: request.id,
          },
        });
      }

      // Look up the ticket's org (via its linked project) so we can verify
      // the supplied author_id belongs to it.
      const [ticketOrg] = await db
        .select({ org_id: projects.org_id })
        .from(tickets)
        .innerJoin(projects, eq(projects.id, tickets.project_id))
        .where(eq(tickets.id, id))
        .limit(1);

      if (!ticketOrg?.org_id) {
        return reply.status(400).send({
          error: {
            code: 'TICKET_NOT_SCOPED',
            message: 'Ticket is not linked to a project/org; cannot validate author_id without a session',
            details: [],
            request_id: request.id,
          },
        });
      }

      const authorLookup = await db.execute(
        sql`SELECT id, display_name, org_id FROM users WHERE id = ${data.author_id} LIMIT 1`,
      );
      const authorRow = Array.isArray(authorLookup)
        ? (authorLookup[0] as any)
        : (authorLookup as any).rows?.[0];

      if (!authorRow) {
        return reply.status(400).send({
          error: {
            code: 'AUTHOR_NOT_FOUND',
            message: 'author_id does not correspond to a known user',
            details: [{ field: 'author_id', issue: 'not_found' }],
            request_id: request.id,
          },
        });
      }

      if (authorRow.org_id !== ticketOrg.org_id) {
        return reply.status(403).send({
          error: {
            code: 'AUTHOR_ORG_MISMATCH',
            message: "author_id belongs to a different org than the ticket's project",
            details: [{ field: 'author_id', issue: 'org_mismatch' }],
            request_id: request.id,
          },
        });
      }

      authorId = authorRow.id;
      authorName = data.author_name ?? authorRow.display_name ?? 'Support Agent';
    }

    // HB-18: `is_internal` is agent-controlled and the server trusts the
    // agent to set it correctly. There is no server-side enforcement that
    // distinguishes "internal notes" from "customer-visible replies" beyond
    // this boolean — an agent (or compromised agent-key holder) can post
    // either. When an internal note is created, log it so that mis-flagged
    // messages can be audited after-the-fact. Consider promoting this to a
    // separate endpoint / scoped permission in a future iteration.
    if (data.is_internal) {
      fastify.log.info({ ticketId: id, authorId }, 'Internal note created');
    }

    const [message] = await db
      .insert(ticketMessages)
      .values({
        ticket_id: id,
        author_type: 'agent',
        author_id: authorId,
        author_name: authorName,
        body: data.body,
        is_internal: data.is_internal,
      })
      .returning();

    // Only broadcast public (non-internal) messages to the ticket room so that
    // customer websocket subscribers don't receive internal notes. Internal
    // notes could be delivered via a future agent-only room.
    if (message && message.is_internal === false) {
      await broadcastTicketMessage(id, {
        id: message.id,
        ticket_id: id,
        body: message.body,
        author_type: 'agent',
        author_name: authorName,
        is_internal: message.is_internal,
        created_at: message.created_at,
      });

      // HB-50: Mirror the agent message onto the linked BBB task so the
      // customer-facing audit trail survives if the ticket is later deleted.
      // Internal notes are intentionally NOT mirrored — they must not leak
      // into the customer-visible BBB task comment thread.
      await mirrorTicketMessageToTask(ticket.task_id, authorName, message.body, request.log);
    }

    // TODO: If not internal and notify_on_agent_reply is enabled, queue email to client

    return reply.status(201).send({ data: message });
  });

  // PATCH /tickets/:id — update ticket status, priority, category
  fastify.patch('/tickets/:id', {
    preHandler: [requireAgentAuth],
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateTicketSchema.parse(request.body);

    const [existing] = await db
      .select({ id: tickets.id, task_id: tickets.task_id })
      .from(tickets)
      .where(eq(tickets.id, id))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
          details: [],
          request_id: request.id,
        },
      });
    }

    const updates: Record<string, unknown> = {};
    if (data.status !== undefined) {
      updates.status = data.status;
      if (data.status === 'resolved') {
        updates.resolved_at = new Date();
      } else if (data.status === 'closed') {
        updates.closed_at = new Date();
      }
    }
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.category !== undefined) updates.category = data.category;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({
        error: {
          code: 'NO_CHANGES',
          message: 'No fields to update',
          details: [],
          request_id: request.id,
        },
      });
    }

    const [updated] = await db
      .update(tickets)
      .set(updates)
      .where(eq(tickets.id, id))
      .returning();

    if (updated && data.status !== undefined) {
      await broadcastTicketStatusChanged(id, data.status);
      // HB-50: Mirror ticket closure onto the linked BBB task so the audit
      // trail survives if the ticket is later deleted.
      if (data.status === 'closed') {
        const agentName = await resolveAgentDisplayName(request.agentUserId);
        await mirrorTicketClosedToTask(existing.task_id, agentName, request.log);
      }
    }

    return reply.send({ data: updated });
  });

  // POST /tickets/:id/close — close a ticket
  fastify.post('/tickets/:id/close', {
    preHandler: [requireAgentAuth],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [ticket] = await db
      .select({ id: tickets.id, status: tickets.status, task_id: tickets.task_id })
      .from(tickets)
      .where(eq(tickets.id, id))
      .limit(1);

    if (!ticket) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
          details: [],
          request_id: request.id,
        },
      });
    }

    const [updated] = await db
      .update(tickets)
      .set({
        status: 'closed',
        closed_at: new Date(),
      })
      .where(eq(tickets.id, id))
      .returning();

    if (updated) {
      await broadcastTicketStatusChanged(id, 'closed');
      // HB-50: Mirror ticket closure onto the linked BBB task so the audit
      // trail survives if the ticket is later deleted.
      const agentName = await resolveAgentDisplayName(request.agentUserId);
      await mirrorTicketClosedToTask(ticket.task_id, agentName, request.log);
    }

    return reply.send({ data: updated });
  });
}
