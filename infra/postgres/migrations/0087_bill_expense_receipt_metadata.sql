-- 0087_bill_expense_receipt_metadata.sql
-- Why: Track receipt file uploads from multipart form submissions and store MinIO metadata.
-- Client impact: additive only. New nullable columns.

ALTER TABLE bill_expenses
  ADD COLUMN IF NOT EXISTS receipt_mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS receipt_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS receipt_uploaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bill_expenses_missing_receipt
  ON bill_expenses(organization_id, status, created_at)
  WHERE status = 'approved' AND receipt_url IS NULL;
