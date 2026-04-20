-- 0138_bolt_evaluation_trace.sql
-- Why: Wave 5 AGENTIC_TODO §12. Persists per-execution rule evaluation trail so
--   bolt_event_trace can explain why a rule fired or skipped. Adds an
--   indexed event_id column so the new trace route can look up all executions
--   triggered by a single ingest event without scanning the trigger_event jsonb.
-- Client impact: additive only. Existing executions keep evaluation_trace NULL
--   and event_id NULL; the index is partial on event_id IS NOT NULL so it only
--   grows with new rows. Nothing reads either column on the write path.

ALTER TABLE bolt_executions
  ADD COLUMN IF NOT EXISTS evaluation_trace jsonb;

ALTER TABLE bolt_executions
  ADD COLUMN IF NOT EXISTS event_id uuid;

CREATE INDEX IF NOT EXISTS idx_bolt_executions_event_id
  ON bolt_executions(event_id) WHERE event_id IS NOT NULL;
