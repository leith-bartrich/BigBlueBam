-- 0111_helpdesk_sla_tracking.sql
-- Why: SLA tracking framework. Add first_response_at and sla_breached_at to tickets, SLA config columns to helpdesk_settings, audit table for breach events.
-- Client impact: additive only. Defaults set; no existing row disturbed.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_first_response_at ON tickets (first_response_at);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_breached_at ON tickets (sla_breached_at);

ALTER TABLE helpdesk_settings
  ADD COLUMN IF NOT EXISTS sla_first_response_minutes INTEGER NOT NULL DEFAULT 480,
  ADD COLUMN IF NOT EXISTS sla_resolution_minutes INTEGER NOT NULL DEFAULT 2880;

CREATE TABLE IF NOT EXISTS helpdesk_sla_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sla_type VARCHAR(50) NOT NULL,
  breached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_emitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_helpdesk_sla_breaches_ticket_id ON helpdesk_sla_breaches (ticket_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_sla_breaches_sla_type ON helpdesk_sla_breaches (sla_type);
