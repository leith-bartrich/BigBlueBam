-- 0091_blast_engagement_event_indexes.sql
-- Why: Support fast engagement summary queries and device breakdown analytics. Denormalize client info for low-latency aggregation.
-- Client impact: additive only. New indexes and nullable column.

ALTER TABLE blast_engagement_events
  ADD COLUMN IF NOT EXISTS client_info VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_blast_engagement_campaign_contact_type
  ON blast_engagement_events (campaign_id, contact_id, event_type);

CREATE INDEX IF NOT EXISTS idx_blast_engagement_client_info
  ON blast_engagement_events (campaign_id, client_info)
  WHERE client_info IS NOT NULL;
