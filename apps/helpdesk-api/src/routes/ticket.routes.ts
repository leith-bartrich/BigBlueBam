import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tickets } from '../db/schema/tickets.js';
import { ticketMessages } from '../db/schema/ticket-messages.js';
import { helpdeskSettings } from '../db/schema/helpdesk-settings.js';
import { tasks, projects, phases, labels } from '../db/schema/bbb-refs.js';
import { requireHelpdeskAuth } from '../plugins/auth.js';
import { broadcastTaskCreated, broadcastTicketStatusChanged } from '../lib/broadcast.js';

const createTicketSchema = z.object({
  subject: z.string().min(1).max(500),
  description: z.string().min(1),
  category: z.string().max(100).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  idempotency_key: z.string().max(200).optional(),
});

const createMessageSchema = z.object({
  body: z.string().min(1),
});

// Lightweight HTML stripper — removes tags to prevent stored-HTML injection.
// For richer sanitization, install DOMPurify/sanitize-html.
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

// Lightweight dedup: hash (user_id + subject + description + hour-bucket) so that
// rapid retries within the same hour return the existing ticket rather than creating
// duplicates. This avoids requiring a schema migration for an idempotency_key column.
function buildDedupHash(userId: string, subject: string, description: string, explicitKey?: string): string {
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  const material = explicitKey
    ? `${userId}:key:${explicitKey}`
    : `${userId}:${hourBucket}:${subject}:${description}`;
  return createHash('sha256').update(material).digest('hex');
}

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

    // HB-19: Sanitize HTML before storing anywhere.
    const safeSubject = stripHtml(data.subject).slice(0, 500);
    const safeDescription = stripHtml(data.description);

    if (!safeSubject || !safeDescription) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Subject and description must contain text after HTML is stripped',
          details: [],
          request_id: request.id,
        },
      });
    }

    // HB-8: Idempotency — look for a recent identical ticket from the same user.
    // Lightweight dedup within a 1-hour window using a hashed marker stored in description
    // is not possible without schema changes, so we query for an existing ticket matching
    // (user, subject, description) created in the last hour as a pragmatic fallback.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const dedupHash = buildDedupHash(user.id, safeSubject, safeDescription, data.idempotency_key);
    void dedupHash; // documented marker; reserved for future idempotency_key column

    const [existingDup] = await db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.helpdesk_user_id, user.id),
          eq(tickets.subject, safeSubject),
          eq(tickets.description, safeDescription),
          gte(tickets.created_at, oneHourAgo),
        ),
      )
      .orderBy(desc(tickets.created_at))
      .limit(1);

    if (existingDup) {
      return reply.status(200).send({
        data: {
          id: existingDup.id,
          ticket_number: existingDup.ticket_number,
          subject: existingDup.subject,
          description: existingDup.description,
          status: existingDup.status,
          priority: existingDup.priority,
          category: existingDup.category,
          task_id: existingDup.task_id,
          created_at: existingDup.created_at,
          updated_at: existingDup.updated_at,
        },
        deduplicated: true,
      });
    }

    // Look up helpdesk settings for default project/phase
    const [settings] = await db
      .select()
      .from(helpdeskSettings)
      .limit(1);

    const projectId: string | null = settings?.default_project_id ?? null;

    // HB-9: Wrap task + ticket creation in a single transaction so partial
    // failure doesn't leave orphaned tasks or tickets behind.
    try {
      const result = await db.transaction(async (tx) => {
        let taskId: string | null = null;
        let fullTaskForBroadcast: Record<string, unknown> | null = null;

        // If we have a default project, create a BBB task
        if (projectId) {
          // Get project for task_id_prefix and sequence
          const [project] = await tx
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

          if (project) {
            // HB-37: Validate default_phase_id — ensure it exists and belongs to the project.
            // If invalid, fall back to the project's is_start=true phase. If none, abort.
            let phaseId: string | null = null;
            if (settings?.default_phase_id) {
              const [configuredPhase] = await tx
                .select({ id: phases.id })
                .from(phases)
                .where(
                  and(
                    eq(phases.id, settings.default_phase_id),
                    eq(phases.project_id, project.id),
                  ),
                )
                .limit(1);
              if (configuredPhase) {
                phaseId = configuredPhase.id;
              }
            }

            if (!phaseId) {
              const [startPhase] = await tx
                .select({ id: phases.id })
                .from(phases)
                .where(and(eq(phases.project_id, project.id), eq(phases.is_start, true)))
                .orderBy(phases.position)
                .limit(1);
              if (startPhase) {
                phaseId = startPhase.id;
              }
            }

            if (!phaseId) {
              // No valid phase — abort rather than create an orphan task with NULL phase_id.
              throw new Error('NO_VALID_PHASE');
            }

            // Increment task_id_sequence atomically
            const [updated] = await tx
              .update(projects)
              .set({
                task_id_sequence: sql`${projects.task_id_sequence} + 1`,
              })
              .where(eq(projects.id, project.id))
              .returning({ task_id_sequence: projects.task_id_sequence });

            const seq = updated?.task_id_sequence ?? 1;
            const humanId = `${project.task_id_prefix}-${seq}`;

            // Find or create "Support Ticket" label
            let [supportLabel] = await tx
              .select()
              .from(labels)
              .where(and(eq(labels.project_id, projectId), eq(labels.name, 'Support Ticket')))
              .limit(1);

            if (!supportLabel) {
              [supportLabel] = await tx
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

            // HB-36: Identify the helpdesk customer via custom_fields so BBB
            // users can trace the task back to its reporter. reporter_id is
            // intentionally left unset (helpdesk users are not BBB users).
            const initialCustomFields = {
              helpdesk_customer_email: user.email,
              helpdesk_customer_id: user.id,
            };

            // Create the BBB task
            const [task] = await tx
              .insert(tasks)
              .values({
                project_id: projectId,
                human_id: humanId,
                title: safeSubject,
                description: safeDescription,
                description_plain: safeDescription,
                phase_id: phaseId,
                priority: data.priority,
                labels: labelIds,
                custom_fields: initialCustomFields,
              })
              .returning();

            if (!task) {
              throw new Error('TASK_INSERT_FAILED');
            }

            taskId = task.id;
            fullTaskForBroadcast = task as Record<string, unknown>;
          }
        }

        // Create the ticket (inside the same transaction)
        const [ticket] = await tx
          .insert(tickets)
          .values({
            helpdesk_user_id: user.id,
            task_id: taskId,
            project_id: projectId,
            subject: safeSubject,
            description: safeDescription,
            priority: data.priority,
            category: data.category ?? null,
          })
          .returning();

        if (!ticket) {
          throw new Error('TICKET_INSERT_FAILED');
        }

        // Update task custom_fields with ticket reference (same transaction)
        if (taskId && projectId) {
          const [updatedTask] = await tx
            .update(tasks)
            .set({
              custom_fields: {
                helpdesk_customer_email: user.email,
                helpdesk_customer_id: user.id,
                helpdesk_ticket_id: ticket.id,
                helpdesk_ticket_number: ticket.ticket_number,
              },
            })
            .where(eq(tasks.id, taskId))
            .returning();
          if (updatedTask) {
            fullTaskForBroadcast = updatedTask as Record<string, unknown>;
          }
        }

        return { ticket, taskId, fullTaskForBroadcast };
      });

      // Broadcast after commit so consumers don't see uncommitted state.
      if (result.taskId && projectId && result.fullTaskForBroadcast) {
        await broadcastTaskCreated(projectId, result.fullTaskForBroadcast);
      }

      return reply.status(201).send({
        data: {
          id: result.ticket.id,
          ticket_number: result.ticket.ticket_number,
          subject: result.ticket.subject,
          description: result.ticket.description,
          status: result.ticket.status,
          priority: result.ticket.priority,
          category: result.ticket.category,
          task_id: result.ticket.task_id,
          created_at: result.ticket.created_at,
          updated_at: result.ticket.updated_at,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'NO_VALID_PHASE') {
        request.log.error({ projectId }, 'Helpdesk cannot create task: no valid phase found for project');
        return reply.status(500).send({
          error: {
            code: 'CONFIGURATION_ERROR',
            message: 'Helpdesk project has no start phase configured. Contact your administrator.',
            details: [],
            request_id: request.id,
          },
        });
      }
      request.log.error({ err }, 'Failed to create helpdesk ticket');
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create ticket',
          details: [],
          request_id: request.id,
        },
      });
    }
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
      .select({ id: tickets.id, status: tickets.status, task_id: tickets.task_id, project_id: tickets.project_id })
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
        body: stripHtml(data.body),
        is_internal: false,
      })
      .returning();

    // HB-15: If the ticket was waiting on the customer, flip it back to open
    // now that the customer has replied, and broadcast the status change.
    if (ticket.status === 'waiting_on_customer') {
      await db
        .update(tickets)
        .set({ status: 'open', updated_at: new Date() })
        .where(eq(tickets.id, id));

      if (ticket.project_id && ticket.task_id) {
        await broadcastTicketStatusChanged(ticket.project_id, ticket.task_id, 'open');
      }
    }

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

    // HB-4: Include helpdesk_user_id in the UPDATE's WHERE clause so a forged
    // ticket id cannot be reopened under another user's ownership between the
    // SELECT and UPDATE.
    const [updated] = await db
      .update(tickets)
      .set({
        status: 'open',
        resolved_at: null,
        closed_at: null,
      })
      .where(and(eq(tickets.id, id), eq(tickets.helpdesk_user_id, user.id)))
      .returning();

    return reply.send({ data: updated });
  });

  // POST /helpdesk/tickets/:id/update-priority — client changes priority
  fastify.post('/helpdesk/tickets/:id/update-priority', { preHandler: [requireHelpdeskAuth] }, async (request, reply) => {
    const user = request.helpdeskUser!;
    const { id } = request.params as { id: string };
    const { priority } = z.object({ priority: z.enum(['low', 'medium', 'high']) }).parse(request.body);

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.helpdesk_user_id, user.id)))
      .limit(1);

    if (!ticket) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Ticket not found', details: [], request_id: request.id },
      });
    }

    const [updated] = await db
      .update(tickets)
      .set({ priority })
      .where(and(eq(tickets.id, id), eq(tickets.helpdesk_user_id, user.id)))
      .returning();

    return reply.send({ data: updated });
  });

  // POST /helpdesk/tickets/:id/close — client closes their ticket
  fastify.post('/helpdesk/tickets/:id/close', { preHandler: [requireHelpdeskAuth] }, async (request, reply) => {
    const user = request.helpdeskUser!;
    const { id } = request.params as { id: string };

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.helpdesk_user_id, user.id)))
      .limit(1);

    if (!ticket) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Ticket not found', details: [], request_id: request.id },
      });
    }

    const [updated] = await db
      .update(tickets)
      .set({ status: 'closed', closed_at: new Date() })
      .where(and(eq(tickets.id, id), eq(tickets.helpdesk_user_id, user.id)))
      .returning();

    // HB-16: Move the linked BBB task to a terminal phase so the board reflects
    // that the customer closed their ticket. Best-effort — don't fail the close.
    if (ticket.task_id) {
      try {
        const [linkedTask] = await db
          .select({ id: tasks.id, project_id: tasks.project_id })
          .from(tasks)
          .where(eq(tasks.id, ticket.task_id))
          .limit(1);

        if (linkedTask) {
          const [terminalPhase] = await db
            .select({ id: phases.id })
            .from(phases)
            .where(
              and(eq(phases.project_id, linkedTask.project_id), eq(phases.is_terminal, true)),
            )
            .orderBy(phases.position)
            .limit(1);

          if (terminalPhase) {
            await db
              .update(tasks)
              .set({ phase_id: terminalPhase.id, updated_at: new Date() })
              .where(eq(tasks.id, linkedTask.id));

            await broadcastTicketStatusChanged(linkedTask.project_id, linkedTask.id, 'closed');
          } else {
            request.log.warn(
              { projectId: linkedTask.project_id, taskId: linkedTask.id },
              'No terminal phase found for project; linked task phase not updated on ticket close',
            );
          }
        }
      } catch (err) {
        request.log.warn({ err, ticketId: id }, 'Failed to move linked task to terminal phase');
      }
    }

    return reply.send({ data: updated });
  });
}
