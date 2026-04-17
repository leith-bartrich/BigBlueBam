-- 0084_bench_report_delivery_tracking.sql
-- Why: Enable worker jobs to track scheduled report delivery attempts without overwriting prior results. Allow admin UI to show send status.
-- Client impact: additive only. New nullable columns, no schema breaks.

ALTER TABLE bench_scheduled_reports
  ADD COLUMN IF NOT EXISTS last_delivery_attempt_at TIMESTAMPTZ;

ALTER TABLE bench_scheduled_reports
  ADD COLUMN IF NOT EXISTS last_delivery_status VARCHAR(20);

ALTER TABLE bench_scheduled_reports
  ADD COLUMN IF NOT EXISTS last_delivery_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bench_reports_delivery_status_check') THEN
    ALTER TABLE bench_scheduled_reports
      ADD CONSTRAINT bench_reports_delivery_status_check
      CHECK (last_delivery_status IS NULL OR last_delivery_status IN ('pending', 'sent', 'failed', 'queued'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bench_reports_scheduled_enabled
  ON bench_scheduled_reports (enabled, last_sent_at)
  WHERE enabled = true;
