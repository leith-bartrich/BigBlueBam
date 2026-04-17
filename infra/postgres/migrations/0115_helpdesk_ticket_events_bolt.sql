-- 0115_helpdesk_ticket_events_bolt.sql
-- Why: Track Bolt event emission on helpdesk_ticket_events so retry logic can find unpublished rows.
-- Client impact: additive only. New columns default NULL.

ALTER TABLE helpdesk_ticket_events
  ADD COLUMN IF NOT EXISTS bolt_event_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bolt_event_emitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_helpdesk_ticket_events_bolt_event_id
  ON helpdesk_ticket_events (bolt_event_id);
