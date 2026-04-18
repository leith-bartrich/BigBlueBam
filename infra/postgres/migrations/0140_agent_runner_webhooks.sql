-- 0140_agent_runner_webhooks.sql
-- Why: Wave 5 AGENTIC_TODO §20. External agent runners subscribe to Bolt
--   events via signed outbound webhooks instead of polling. This replaces
--   the poll-or-open-a-WebSocket pattern with an at-least-once push
--   delivery path with HMAC signing, backoff, and a dead-letter queue.
-- Client impact: additive only. webhook_enabled defaults to false so
--   existing runners remain pull-mode. New agent_webhook_deliveries table
--   is write-only for producers and read-only for operators until a
--   runner opts in via agent_webhook_configure.

-- ──────────────────────────────────────────────────────────────────────
-- agent_runners: webhook configuration columns
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE agent_runners
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_secret_hash text,
  ADD COLUMN IF NOT EXISTS webhook_event_filter jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS webhook_last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_last_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS webhook_enabled boolean NOT NULL DEFAULT false;

-- Partial index supports the dispatcher hook scan "which runners are
-- subscribed to events right now?" without scanning every row.
CREATE INDEX IF NOT EXISTS idx_agent_runners_webhook_enabled
  ON agent_runners(org_id)
  WHERE webhook_enabled = true;

-- ──────────────────────────────────────────────────────────────────────
-- agent_webhook_deliveries
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  runner_id uuid NOT NULL REFERENCES agent_runners(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  event_source text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','delivered','failed','dead_lettered')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text,
  response_status_code integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  next_retry_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_webhook_deliv_runner
  ON agent_webhook_deliveries(runner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_webhook_deliv_pending
  ON agent_webhook_deliveries(next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_agent_webhook_deliv_dlq
  ON agent_webhook_deliveries(status)
  WHERE status = 'dead_lettered';
CREATE INDEX IF NOT EXISTS idx_agent_webhook_deliv_org_created
  ON agent_webhook_deliveries(org_id, created_at DESC);

-- RLS (follows the pattern from 0116_rls_foundation.sql and
-- 0127_agent_identity_heartbeat.sql). Enabled unconditionally; the app
-- role still has BYPASSRLS in soft-rollout mode, so policies are
-- advisory until BBB_RLS_ENFORCE=1 flips the role.
ALTER TABLE agent_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_webhook_deliv_org_isolation ON agent_webhook_deliveries;
CREATE POLICY agent_webhook_deliv_org_isolation ON agent_webhook_deliveries
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);
