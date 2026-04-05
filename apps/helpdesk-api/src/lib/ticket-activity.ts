/**
 * HB-45: best-effort audit logger for helpdesk ticket events.
 *
 * Every lifecycle event on a ticket — creation, status/priority/assignee
 * changes, messages posted, closure, reopening — is appended as a row in
 * `ticket_activity_log`. The table is the authoritative timeline for
 * "what happened to this ticket, and who did it?" queries, independent
 * of the `ticket_messages` stream (which only records conversational
 * content) and of the BBB-side `activity_log` (which is scoped to tasks
 * and projects, not tickets).
 *
 * This helper is intentionally non-throwing — same contract as
 * lib/task-sync.ts. Audit writes must never break a user-facing ticket
 * operation, so failures are swallowed and logged. The cost of a missed
 * audit row is acceptable; the cost of failing a customer's ticket
 * create/close/reply because an audit insert hiccupped is not.
 */
import { db } from '../db/index.js';
import { ticketActivityLog } from '../db/schema/ticket-activity-log.js';

type Logger = { warn: (obj: unknown, msg?: string) => void };

export type TicketActivityActorType = 'customer' | 'agent' | 'system';

export type TicketActivityAction =
  | 'ticket.created'
  | 'ticket.status_changed'
  | 'ticket.priority_changed'
  | 'ticket.category_changed'
  | 'ticket.assigned'
  | 'ticket.closed'
  | 'ticket.reopened'
  // HB-55: duplicate / merge lifecycle
  | 'ticket.marked_duplicate'
  | 'ticket.duplicate_cleared'
  | 'ticket.merged'
  | 'ticket.merge_received'
  | 'message.posted';

export interface LogTicketActivityOptions {
  ticketId: string;
  actorType: TicketActivityActorType;
  actorId?: string | null;
  action: TicketActivityAction;
  details?: Record<string, unknown> | null;
  logger?: Logger;
}

export async function logTicketActivity(opts: LogTicketActivityOptions): Promise<void> {
  try {
    await db.insert(ticketActivityLog).values({
      ticket_id: opts.ticketId,
      actor_type: opts.actorType,
      actor_id: opts.actorId ?? null,
      action: opts.action,
      details: opts.details ?? null,
    });
  } catch (err) {
    opts.logger?.warn(
      { err, ticketId: opts.ticketId, action: opts.action },
      'ticket-activity: failed to write audit row',
    );
  }
}
