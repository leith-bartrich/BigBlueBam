-- ─────────────────────────────────────────────────────────────────────────
-- 0015_ticket_events.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Client impact: additive only (new table + two indexes).
-- Why: HB-47 — helpdesk realtime is delivered via Redis PubSub. PubSub is
--      push-only and non-durable: any subscriber that is not connected at
--      publish time silently misses the event. Customers with flaky mobile
--      networks or laptops that suspend briefly routinely reconnect to a
--      WebSocket that shows a stale ticket thread, because the new message
--      / status change fired during the gap and there is no buffer to
--      replay from. The authoritative state lives in `tickets` and
--      `ticket_messages`, but reconstructing "what did I miss since
--      event id N" from those tables requires walking every mutable
--      column and cross-referencing timestamps — expensive and fragile.
--
--      This migration introduces a durable, append-only event log that
--      mirrors every realtime broadcast. Each row carries a monotonic
--      `bigserial` id so clients can persist "last seen event id" in
--      localStorage and request `events where id > N` on reconnect to
--      catch up precisely, without a full refetch. The `(ticket_id, id)`
--      index covers the per-ticket replay query cheaply; the
--      `created_at` index is for the future trimmer job (see below).
--
--      Redis PubSub is retained as the push-optimization layer for
--      already-connected clients — the DB write is the new source of
--      truth and the publish happens after. On DB write failure we
--      still publish (prefer a live push over a silent drop) and log
--      at error, so the gap is observable.
--
--      NOTE: this table has no TTL today. A future worker job should
--      trim rows older than N days (e.g. 30) to keep growth bounded.
--      Out of scope for this wave; noted in docs/architecture.md.
--
-- Client impact: additive only (new table, no changes to existing tables
--      or columns). Existing helpdesk-api deploys continue to work
--      unchanged until the matching code deploy starts writing rows.
--      Replay endpoints and the WS `resume` message are additive; old
--      clients that don't send `resume` fall back to the previous
--      refetch-on-reconnect behaviour. The table starts empty — there
--      is no backfill of historical events.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS helpdesk_ticket_events (
    id          bigserial PRIMARY KEY,
    ticket_id   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    event_type  varchar(50) NOT NULL,
    payload     jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ticket_events_ticket
    ON helpdesk_ticket_events (ticket_id, id);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ticket_events_created_at
    ON helpdesk_ticket_events (created_at);
