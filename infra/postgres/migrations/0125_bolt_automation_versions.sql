-- 0125_bolt_automation_versions.sql
--
-- Why: Add versioning to Bolt automations so users can snapshot, inspect,
--      and roll back to earlier configurations of their automation rules.
-- Client impact: additive only

CREATE TABLE IF NOT EXISTS bolt_automation_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES bolt_automations(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL DEFAULT 1,
  snapshot    JSONB NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_bolt_automation_versions_automation
  ON bolt_automation_versions (automation_id, version DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bolt_automation_versions_uniq
  ON bolt_automation_versions (automation_id, version);
