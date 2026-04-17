-- 0092_blast_campaign_completion_tracking.sql
-- Why: Track campaign.completed event emission for idempotency on worker retries. Prevent duplicate emission.
-- Client impact: additive only. New nullable column.

ALTER TABLE blast_campaigns
  ADD COLUMN IF NOT EXISTS completion_event_emitted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_blast_campaigns_completion_pending
  ON blast_campaigns (status, completion_event_emitted)
  WHERE status = 'sent' AND completion_event_emitted = false;
