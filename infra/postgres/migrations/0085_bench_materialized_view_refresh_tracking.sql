-- 0085_bench_materialized_view_refresh_tracking.sql
-- Why: Track materialized view refresh attempts, failures, and next scheduled time for the refresh scheduler worker.
-- Client impact: additive only. New nullable columns.

ALTER TABLE bench_materialized_views
  ADD COLUMN IF NOT EXISTS last_refresh_attempt_at TIMESTAMPTZ;

ALTER TABLE bench_materialized_views
  ADD COLUMN IF NOT EXISTS last_refresh_status VARCHAR(20);

ALTER TABLE bench_materialized_views
  ADD COLUMN IF NOT EXISTS last_refresh_error TEXT;

ALTER TABLE bench_materialized_views
  ADD COLUMN IF NOT EXISTS next_scheduled_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bench_mv_refresh_status_check') THEN
    ALTER TABLE bench_materialized_views
      ADD CONSTRAINT bench_mv_refresh_status_check
      CHECK (last_refresh_status IS NULL OR last_refresh_status IN ('success', 'failed', 'in_progress'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bench_mv_scheduled
  ON bench_materialized_views (next_scheduled_at)
  WHERE next_scheduled_at IS NOT NULL;
