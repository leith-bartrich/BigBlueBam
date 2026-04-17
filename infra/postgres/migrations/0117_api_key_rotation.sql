-- 0117_api_key_rotation.sql
-- Why: Enable API key rotation with a grace period. Users rotate a key (invalidate old, issue new) with a configurable grace window during which both keys work, so the rotator can update clients without downtime.
-- Client impact: additive only. Existing keys have NULL in new columns; rotation logic is opt-in via the new POST /api-keys/:id/rotate route.

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rotation_grace_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS predecessor_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_rotation_grace
  ON api_keys(rotation_grace_expires_at)
  WHERE rotation_grace_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_predecessor
  ON api_keys(predecessor_id);
