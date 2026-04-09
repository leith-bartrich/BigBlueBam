-- 0039_bolt_max_chain_depth.sql
-- Why: Add max_chain_depth column to bolt_automations for recursion/loop prevention (BOLT-005).
-- Client impact: additive only

ALTER TABLE bolt_automations ADD COLUMN IF NOT EXISTS max_chain_depth INTEGER NOT NULL DEFAULT 5;
