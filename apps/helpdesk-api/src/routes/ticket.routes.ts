import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tickets } from '../db/schema/tickets.js';
import { ticketMessages } from '../db/schema/ticket-messages.js';
import { helpdeskSettings } from '../db/schema/helpdesk-settings.js';
import { tasks, projects, labels } from '../db/schema/bbb-refs.js';
import { requireHelpdeskAuth } from '../plugins/auth.js';
import { broadcastTaskCreated } from '../lib/broadcast.js';

const createTicketSchema = z.object({
  subject: z.string().min(1).max(500),
  description: z.string().min(1),
  category: z.string().max(100).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

const createMessageSchema = z.object({
  body: z.string().min(1),
});

export default async function ticketRoutes(fastify: FastifyInstance) {
  // GET /helpdesk/tickets — list current user's tickets
  fastify.get('/helpdesk/tickets', { preHandler: [requireHelpdeskAuth] }, async (request, reply) => {
    const user = request.helpdeskUser!;

    const rows = await db
      .select({
        id: tickets.id,
        ticket_number: tickets.ticket_number,
        subject: tickets.subject,
        status: tickets.status,
        priority: tickets.priority,
        category: tickets.category,
        created_at: tickets.created_at,
        updated_at: tickets.updated_at,
      })
      .from(tickets)
      .where(eq(tickets.helpdesk_user_id, user.id))
      .orderBy(desc(tickets.updated_at));

    return reply.send({ data: rows });
  });

  // POST /helpdesk/tickets — create ticket
  fastify.post('/helpdesk/tickets', { preHandler: [requireHelpdeskAuth] }, async (request, reply) => {
    const user = request.helpdeskUser!;
    const data = createTicketSchema.parse(request.body);

    // Look up helpdesk settings for default project/phase
    const [settings] = await db
      .select()
      .from(helpdeskSettings)
      .limit(1);

    let taskId: string | null = null;
    let projectId: string | null = settings?.default_project_id ?? null;

    // If we have a default project, create a BBB task
    if (projectId) {
      // Get project for task_id_prefix and sequence
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (project) {
        // Increment task_id_sequence atomically
        const [updated] = await db
          .update(projects)
          .set({
            task_id_sequence: sql`${projects.task_id_sequence} + 1`,
          })
          .where(eq(projects.id, project.id))
          .returning({ task_id_sequence: projects.task_id_sequence });

        const seq = updated?.task_id_sequence ?? 1;
        const humanId = `${project.task_id_prefix}-${seq}`;

        // Find or create "Support Ticket" label
        let [supportLabel] = await db
          .select()
          .from(labels)
          .where(and(eq(labels.project_id, projectId), eq(labels.name, 'Support Ticket')))
          .limit(1);

        if (!supportLabel) {
          [supportLabel] = await db
            .insert(labels)
            .values({
              project_id: projectId,
              name: 'Support Ticket',
              color: '#6366f1',
              description: 'Ticket submitted via helpdesk portal',
            })
            .returning();
        }

        const labelIds = supportLabel ? [supportLabel.id] : [];

        // Create the BBB task
        const [task] = await db
          .insert(tasks)
          .values({
            project_id: projectId,
            human_id: humanId,
            title: data.subject,
            description: data.description,
            description_plain: data.description,
            phase_id: settings?.default_phase_id ?? null,
            priority: data.priority,
            labels: labelIds,
            custom_fields: {},
          })
          .returning();

        if (task) {
          taskId = task.id;

          // Store helpdesk reference in custom_fields
          await db
            .update(tasks)
            .set({
              custom_fields: {
                helpdesk_ticket_id: '', // will be updated after ticket is created
                helpdesk_ticket_number: 0,
              },
            })
            .where(eq(tasks.id, task.id));
        }
      }
    }

    // Create the ticket
    const [ticket] = await db
      .insert(tickets)
      .values({
        helpdesk_user_id: user.id,
        task_id: taskId,
        project_id: projectId,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        category: data.category ?? null,
      })
      .returning();

    if (!ticket) {
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create ticket',
          details: [],
          request_id: request.id,
        },
      });
    }

    // Update task custom_fields with ticket reference and broadcast
    if (taskId && projectId) {
      await db
        .update(tasks)
        .set({
          custom_fields: {
            helpdesk_ticket_id: ticket.id,
            helpdesk_ticket_number: ticket.ticket_number,
          },
        })
        .where(eq(tasks.id, taskId));

      // Broadcast to BBB WebSocket so board updates instantly
      const [fullTask] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (fullTask) {
        await broadcastTaskCreated(projectId, fullTask as Record<string, unknown>);
      }
    }

    return reply.status(201).send({
      data: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        task_id: ticket.task_id,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
      },
    });
  });

  // GET /helpdesk/tickets/:id — ticket detail with messages
  fastify.get('/helpdesk/tickets/:id', { preHandler: [requireHelpdeskAuth] }, async (request, reply) => {
    const user = request.helpdeskUser!;
    const { id } = request.params as { id: string };

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.helpdesk_user_id, user.id)))
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

    // Get messages — exclude internal ones
    const messages = await db
      .select()
      .from(ticketMessages)
      .where(
        and(
          eq(ticketMessages.ticket_id, id),
          eq(ticketMessages.is_internal, false),
        ),
      )
      .orderBy(ticketMessages.created_at);

    return reply.send({
      data: {
        ...ticket,
        messages,
      },
    });
  });

  // POST /helpdesk/tickets/:id/messages — post a message
  fastify.post('/helpdesk/tickets/:id/messages', { preHandler: [requireHelpdeskAuth] }, async (request, reply) => {
    const user = request.helpdeskUser!;
    const { id } = request.params as { id: string };
    const data = createMessageSchema.parse(request.body);

    // Verify ticket belongs to user
    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.helpdesk_user_id, user.id)))
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
        author_type: 'client',
        author_id: user.id,
        author_name: user.display_name,
        body: data.body,
        is_internal: false,
      })
      .returning();

    return reply.status(201).send({ data: message });
  });

  // POST /helpdesk/tickets/:id/reopen — reopen a resolved/closed ticket
  fastify.post('/helpdesk/tickets/:id/reopen', { preHandler: [requireHelpdeskAuth] }, async (request, reply) => {
    const user = request.helpdeskUser!;
    const { id } = request.params as { id: string };

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.helpdesk_user_id, user.id)))
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

    if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
      return reply.status(400).send({
        error: {
          code: 'INVALID_STATE',
          message: 'Ticket can only be reopened if it is resolved or closed',
          details: [],
          request_id: request.id,
        },
      });
    }

    const [updated] = await db
      .update(tickets)
      .set({
        status: 'open',
        resolved_at: null,
        closed_at: null,
      })
      .where(eq(tickets.id, id))
      .returning();

    return reply.send({ data: updated });
  });
}
