-- 0131_attachments_scan_status.sql
-- Why: Wave 4 AGENTIC_TODO §17. Surfaces scan status, scan signature, and scanned_at as
--   first-class columns on Bam's attachments table so MCP attachment tools can expose the
--   scanner verdict without reaching into MinIO. Mirrors the shape helpdesk already has on
--   helpdesk_ticket_attachments (migration 0114).
-- Client impact: additive only. New columns default to 'pending' / NULL.

ALTER TABLE attachments ADD COLUMN IF NOT EXISTS scan_status varchar(50) NOT NULL DEFAULT 'pending';
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS scan_signature text;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS scanned_at timestamptz;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS scan_error text;

DO $$ BEGIN
  ALTER TABLE attachments ADD CONSTRAINT attachments_scan_status_check
    CHECK (scan_status IN ('pending', 'clean', 'infected', 'error'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_attachments_scan_status ON attachments(scan_status);
