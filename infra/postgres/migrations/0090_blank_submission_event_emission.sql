-- 0090_blank_submission_event_emission.sql
-- Why: Track Bolt event emission success for idempotency on worker retries. Prevent duplicate event publishing.
-- Client impact: additive only. New nullable columns for idempotency tracking.

ALTER TABLE blank_submissions
  ADD COLUMN IF NOT EXISTS bolt_events_emitted BOOLEAN DEFAULT false;

ALTER TABLE blank_submissions
  ADD COLUMN IF NOT EXISTS bolt_event_emit_error TEXT;

CREATE INDEX IF NOT EXISTS idx_blank_submissions_bolt_events_pending
  ON blank_submissions (bolt_events_emitted)
  WHERE bolt_events_emitted = false;
