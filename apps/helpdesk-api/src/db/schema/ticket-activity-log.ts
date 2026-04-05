import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { tickets } from './tickets.js';

/**
 * HB-45: append-only audit trail for ticket lifecycle events on the
 * helpdesk side (created, status/priority/assignee changes, messages
 * posted, closed, reopened).
 *
 * Schema notes:
 *   - actor_type ∈ {customer, agent, system}. No FK on actor_id because
 *     it targets helpdesk_users.id or users.id depending on actor_type
 *     (or NULL for 'system' events).
 *   - details is a free-form JSONB bag; canonical use is {from, to} for
 *     scalar field changes (status, priority, assignee).
 *   - Rows are append-only. Row lifetime is bounded only by the parent
 *     ticket via ON DELETE CASCADE.
 */
export const ticketActivityLog = pgTable(
  'ticket_activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_id: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    actor_type: varchar('actor_type', { length: 20 }).notNull(),
    actor_id: uuid('actor_id'),
    action: varchar('action', { length: 50 }).notNull(),
    details: jsonb('details'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ticket_activity_log_ticket_created').on(table.ticket_id, table.created_at),
  ],
);
