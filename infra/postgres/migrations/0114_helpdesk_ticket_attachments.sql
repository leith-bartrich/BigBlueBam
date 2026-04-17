-- 0114_helpdesk_ticket_attachments.sql
-- Why: MinIO-backed file attachment metadata. Tracks storage_key, content_type, size, virus scan status.
-- Client impact: additive only. New table.

CREATE TABLE IF NOT EXISTS helpdesk_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES helpdesk_users(id) ON DELETE CASCADE,
  filename VARCHAR(512) NOT NULL,
  content_type VARCHAR(128) NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_key VARCHAR(1024) NOT NULL,
  scan_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  scan_error TEXT,
  scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ticket_attachments_ticket_id ON helpdesk_ticket_attachments (ticket_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_ticket_attachments_scan_status ON helpdesk_ticket_attachments (scan_status);
