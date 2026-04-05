-- ─────────────────────────────────────────────────────────────────────────
-- 0010_ticket_activity_log.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Client impact: additive only (new table, no changes to existing
--      tables). The helpdesk-api begins writing to this table on the
--      next deploy; existing tickets will have no historical backfill
--      (audit starts at deploy time).
-- Why: HB-45 — helpdesk ticket events (status changes, reassignments,
--      customer/agent replies, reopens, closures) were not independently
--      audited on the helpdesk side. The BBB side has `activity_log`, but
--      the helpdesk had no equivalent: reconstructing a ticket's timeline
--      ("when was it reopened? by whom? did the agent change assignee?")
--      required inference from `ticket_messages` ordering, which is both
--      fragile and incomplete (status/priority/assignee PATCHes leave no
--      message trace at all). This migration introduces a dedicated,
--      append-only audit table scoped to tickets.
--
--      The actor is described by (actor_type, actor_id) where
--      actor_type ∈ {customer, agent, system}. `customer` references
--      helpdesk_users.id, `agent` references users.id (BBB users), and
--      `system` has NULL actor_id. No FK is enforced on actor_id because
--      the column targets two different tables depending on actor_type;
--      referential cleanup is handled by the ON DELETE CASCADE on
--      ticket_id (deleting a ticket drops its audit rows).
--
--      The (ticket_id, created_at DESC) index makes the expected timeline
--      read pattern — "fetch the last N events for ticket X in order" —
--      cheap without a separate sort.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    actor_type varchar(20) NOT NULL CHECK (actor_type IN ('customer', 'agent', 'system')),
    actor_id uuid,
    action varchar(50) NOT NULL,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_activity_log_ticket_created
    ON ticket_activity_log (ticket_id, created_at DESC);
