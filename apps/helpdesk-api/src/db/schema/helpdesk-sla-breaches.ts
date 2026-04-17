import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { tickets } from './tickets.js';

/**
 * G4 / SLA tracking audit table (migration 0111).
 *
 * One row per breach event. `sla_type` is either `first_response` or
 * `resolution`. `event_emitted_at` is stamped when the corresponding
 * `ticket.sla_breached` Bolt event has been published so that a future
 * worker sweep can retry publishing for rows where it is still NULL.
 *
 * Worker-side breach detection is out of scope for Wave 2 (deferred), but
 * the schema is exposed here so service code can write to it when the
 * sweeper lands.
 */
export const helpdeskSlaBreaches = pgTable(
  'helpdesk_sla_breaches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_id: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    sla_type: varchar('sla_type', { length: 50 }).notNull(),
    breached_at: timestamp('breached_at', { withTimezone: true }).defaultNow().notNull(),
    event_emitted_at: timestamp('event_emitted_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_helpdesk_sla_breaches_ticket_id').on(table.ticket_id),
    index('idx_helpdesk_sla_breaches_sla_type').on(table.sla_type),
  ],
);
