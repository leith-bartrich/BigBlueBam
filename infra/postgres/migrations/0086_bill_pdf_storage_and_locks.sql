-- 0086_bill_pdf_storage_and_locks.sql
-- Why: Support async PDF generation tracking and overdue reminder idempotency. Add indexes for PDF pending and overdue scanning.
-- Client impact: additive only. New nullable columns and indexes.

ALTER TABLE bill_invoices
  ADD COLUMN IF NOT EXISTS pdf_generation_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_generation_locked_by VARCHAR(100);

ALTER TABLE bill_invoices
  ADD COLUMN IF NOT EXISTS overdue_reminder_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE bill_invoices
  ADD COLUMN IF NOT EXISTS overdue_reminder_last_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bill_invoices_pdf_pending
  ON bill_invoices(organization_id, status)
  WHERE pdf_url IS NULL AND status NOT IN ('draft', 'void');

CREATE INDEX IF NOT EXISTS idx_bill_invoices_overdue
  ON bill_invoices(organization_id, due_date, status)
  WHERE status NOT IN ('paid', 'void', 'written_off');
