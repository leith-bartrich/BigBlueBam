-- 0096_bolt_event_naming_migration.sql
-- Why: Normalize historical trigger_event values in bolt_automations and bolt_executions
--   from the prefixed 'bond.deal.rotting' to the bare 'deal.rotting' per the Wave 0.4
--   naming convention (bare event names with explicit source argument). This lets existing
--   automations continue to match after the worker is updated to emit the bare name.
-- Client impact: rewrites JSONB/text field values. No schema change. Idempotent: re-running
--   this migration matches zero rows on the second pass.

UPDATE bolt_executions
SET trigger_event = jsonb_set(
  trigger_event,
  '{event_type}',
  to_jsonb('deal.rotting'::text),
  false
)
WHERE trigger_event->>'event_type' = 'bond.deal.rotting';

UPDATE bolt_automations
SET trigger_event = 'deal.rotting'
WHERE trigger_event = 'bond.deal.rotting';
