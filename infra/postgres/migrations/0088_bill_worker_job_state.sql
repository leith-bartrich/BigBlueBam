-- 0088_bill_worker_job_state.sql
-- Why: Track worker job state for idempotent retries and progress monitoring on PDF generation and email delivery.
-- Client impact: additive only. New table, no existing rows affected.

CREATE TABLE IF NOT EXISTS bill_worker_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id          UUID REFERENCES bill_invoices(id) ON DELETE CASCADE,
    expense_id          UUID REFERENCES bill_expenses(id) ON DELETE CASCADE,
    job_type            VARCHAR(50) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message       TEXT,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bill_worker_jobs_type_check') THEN
    ALTER TABLE bill_worker_jobs
      ADD CONSTRAINT bill_worker_jobs_type_check
      CHECK (job_type IN ('pdf_generate', 'email_send', 'reminder_check'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bill_worker_jobs_status_check') THEN
    ALTER TABLE bill_worker_jobs
      ADD CONSTRAINT bill_worker_jobs_status_check
      CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bill_worker_jobs_org ON bill_worker_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_bill_worker_jobs_invoice ON bill_worker_jobs(invoice_id, job_type);
CREATE INDEX IF NOT EXISTS idx_bill_worker_jobs_status ON bill_worker_jobs(status, created_at);
