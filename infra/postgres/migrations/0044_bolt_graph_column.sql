-- 0044_bolt_graph_column.sql
-- Why: Persist the node-graph editor's visual model (nodes/edges/positions)
--      so the advanced editor can round-trip an automation without losing
--      layout. Adds data_version as forward-infrastructure for future shape
--      migrations even though no migrators exist at this point. Conditions
--      and actions rows remain authoritative for execution.
-- Client impact: additive only. Existing rows default to data_version=1.

ALTER TABLE bolt_automations ADD COLUMN IF NOT EXISTS graph JSONB;
ALTER TABLE bolt_automations ADD COLUMN IF NOT EXISTS graph_mode VARCHAR(16);
  -- 'simple' | 'advanced' | NULL (never opened in graph mode yet)
ALTER TABLE bolt_automations ADD COLUMN IF NOT EXISTS data_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS bolt_automation_data_migrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES bolt_automations(id) ON DELETE CASCADE,
  from_version  INTEGER NOT NULL,
  to_version    INTEGER NOT NULL,
  migrated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  migrated_by   UUID REFERENCES users(id),
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_bolt_automation_data_migrations_automation
  ON bolt_automation_data_migrations(automation_id, migrated_at DESC);
