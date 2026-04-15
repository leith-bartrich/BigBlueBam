import { pgTable, uuid, varchar, jsonb, timestamp, index, bigserial } from 'drizzle-orm/pg-core';
import { tickets } from './tickets.js';

/**
 * HB-47: durable event log for helpdesk ticket realtime broadcasts.
 *
 * Every call to a `broadcastTicket*` function persists a row here BEFORE
 * publishing to Redis PubSub. This gives reconnecting clients a
 * replayable source of truth — they persist the highest `id` they have
 * seen in localStorage and request `events where id > last_seen` on
 * reconnect to catch up without a full refetch.
 *
 * Schema notes:
 *   - `id` is bigserial so it forms a single monotonic sequence across
 *     all tickets. Per-ticket ordering comes from the
 *     (ticket_id, id) composite index.
 *   - `event_type` mirrors the `type` field in the published PubSub
 *     payload (e.g. ticket.message.created, ticket.status.changed).
 *   - `payload` is the exact data blob sent to clients; no FKs so
 *     schema drift on tickets/ticket_messages doesn't break replay.
 *   - Rows are append-only. ON DELETE CASCADE on ticket_id means
 *     deleting a ticket drops its event log too — acceptable since
 *     a deleted ticket has no clients to replay to.
 *
 * The table is unbounded today. A future worker job should trim rows
 * older than N days; see docs/architecture.md.
 */
export const helpdeskTicketEvents = pgTable(
  'helpdesk_ticket_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ticket_id: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    event_type: varchar('event_type', { length: 50 }).notNull(),
    payload: jsonb('payload').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // G3 (migration 0115). Bolt emission tracking so that retry sweeps can
    // find rows whose corresponding Bolt event never published. bolt_event_id
    // is the id returned by /v1/events/ingest if we ever wire it up; for now
    // we only stamp bolt_event_emitted_at on success.
    bolt_event_id: varchar('bolt_event_id', { length: 255 }),
    bolt_event_emitted_at: timestamp('bolt_event_emitted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_helpdesk_ticket_events_ticket').on(table.ticket_id, table.id),
    index('idx_helpdesk_ticket_events_created_at').on(table.created_at),
    index('idx_helpdesk_ticket_events_bolt_event_id').on(table.bolt_event_id),
  ],
);
