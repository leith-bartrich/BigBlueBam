import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tickets } from '../db/schema/tickets.js';
import { ticketMessages } from '../db/schema/ticket-messages.js';
import { env } from '../env.js';

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
 * Verify the request has a valid agent API key.
 * Agents authenticate via the X-Agent-Key header or Bearer token.
 */
async function requireAgentAuth(request: FastifyRequest, reply: FastifyReply) {
  // Method 1: Check BBB session cookie (shared database)
  const sessionCookie = request.cookies?.session;
  if (sessionCookie) {
    try {
      const result = await db.execute(
        sql`SELECT s.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ${sessionCookie} AND s.expires_at > now() LIMIT 1`
      );
      if (result && (Array.isArray(result) ? result.length > 0 : (result as any).rows?.length > 0 || (result as any).length > 0)) {
        return; // Authenticated via BBB session
      }
    } catch {
      // Fall through to API key check
    }
  }

  // Method 2: Check agent API key
  const agentKey = env.AGENT_API_KEY;
  const provided =
    (request.headers['x-agent-key'] as string) ??
    request.headers.authorization?.replace('Bearer ', '');

  if (agentKey && provided && provided === agentKey) {
    return; // Authenticated via API key
  }

  if (!agentKey && !sessionCookie) {
    return reply.status(503).send({
      error: {
        code: 'AGENT_AUTH_DISABLED',
        message: 'Agent authentication is not configured',
        details: [],
        request_id: request.id,
      },
    });
  }

  if (true) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid agent API key',
        details: [],
        request_id: request.id,
      },
    });
  }
}

export default async function agentRoutes(fastify: FastifyInstance) {
  // GET /tickets — list all tickets (admin)
  fastify.get('/tickets', { preHandler: [requireAgentAuth] }, async (request, reply) => {
    const query = request.query as { status?: string; project_id?: string };

    let rows;
    if (query.status && query.project_id) {
      rows = await db
        .select()
        .from(tickets)
        .where(and(eq(tickets.status, query.status), eq(tickets.project_id, query.project_id)))
        .orderBy(desc(tickets.updated_at));
    } else if (query.status) {
      rows = await db
        .select()
        .from(tickets)
        .where(eq(tickets.status, query.status))
        .orderBy(desc(tickets.updated_at));
    } else if (query.project_id) {
      rows = await db
        .select()
        .from(tickets)
        .where(eq(tickets.project_id, query.project_id))
        .orderBy(desc(tickets.updated_at));
    } else {
      rows = await db
        .select()
        .from(tickets)
        .orderBy(desc(tickets.updated_at));
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
  fastify.post('/tickets/:id/messages', { preHandler: [requireAgentAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = agentMessageSchema.parse(request.body);

    // Verify ticket exists
    const [ticket] = await db
      .select({ id: tickets.id })
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

    // Resolve author from session if not provided
    let authorId = data.author_id ?? '00000000-0000-0000-0000-000000000000';
    let authorName = data.author_name ?? 'Support Agent';
    const sessionCookie = request.cookies?.session;
    if (sessionCookie && (!data.author_id || !data.author_name)) {
      try {
        const rows = await db.execute(
          sql`SELECT u.id, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ${sessionCookie} LIMIT 1`
        );
        const user = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0];
        if (user) {
          authorId = (user as any).id ?? authorId;
          authorName = (user as any).display_name ?? authorName;
        }
      } catch { /* use defaults */ }
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

    // TODO: If not internal and notify_on_agent_reply is enabled, queue email to client

    return reply.status(201).send({ data: message });
  });

  // PATCH /tickets/:id — update ticket status, priority, category
  fastify.patch('/tickets/:id', { preHandler: [requireAgentAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateTicketSchema.parse(request.body);

    const [existing] = await db
      .select({ id: tickets.id })
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

    return reply.send({ data: updated });
  });

  // POST /tickets/:id/close — close a ticket
  fastify.post('/tickets/:id/close', { preHandler: [requireAgentAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [ticket] = await db
      .select({ id: tickets.id, status: tickets.status })
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

    return reply.send({ data: updated });
  });
}
