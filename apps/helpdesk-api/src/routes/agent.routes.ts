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
  author_name: z.string().min(1).max(100),
  author_id: z.string().uuid(),
});

/**
 * Verify the request has a valid agent API key.
 * Agents authenticate via the X-Agent-Key header or Bearer token.
 */
async function requireAgentAuth(request: FastifyRequest, reply: FastifyReply) {
  const agentKey = env.AGENT_API_KEY;
  if (!agentKey) {
    return reply.status(503).send({
      error: {
        code: 'AGENT_AUTH_DISABLED',
        message: 'Agent API key is not configured',
        details: [],
        request_id: request.id,
      },
    });
  }

  const provided =
    (request.headers['x-agent-key'] as string) ??
    request.headers.authorization?.replace('Bearer ', '');

  if (!provided || provided !== agentKey) {
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

    const [message] = await db
      .insert(ticketMessages)
      .values({
        ticket_id: id,
        author_type: 'agent',
        author_id: data.author_id,
        author_name: data.author_name,
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
