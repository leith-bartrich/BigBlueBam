-- 0097_bolt_notify_owner_on_failure.sql
-- Why: Add opt-in flag to notify automation owner via Banter DM when execution fails.
-- Client impact: additive only. Default false; opt-in per automation.

ALTER TABLE bolt_automations
  ADD COLUMN IF NOT EXISTS notify_owner_on_failure BOOLEAN NOT NULL DEFAULT false;
