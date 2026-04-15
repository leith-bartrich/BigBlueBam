-- 0120_beacon_event_naming_rewrite.sql
-- Why: Normalize historical trigger_event values in bolt_automations and bolt_executions
--   from the prefixed 'beacon.comment.created' and 'beacon.attachment.uploaded' to the
--   bare 'comment.created' and 'attachment.uploaded' per the Wave 0.4 naming convention
--   (bare event names with explicit source argument). Follows the same pattern as
--   0096_bolt_event_naming_migration.sql did for bond.deal.rotting. The Beacon producers
--   were updated to emit the bare names in the same commit that ships this migration.
-- Client impact: rewrites JSONB/text field values. No schema change. Idempotent: re-running
--   this migration matches zero rows on the second pass.

UPDATE bolt_executions
SET trigger_event = jsonb_set(
  trigger_event,
  '{event_type}',
  to_jsonb('comment.created'::text),
  false
)
WHERE trigger_event->>'event_type' = 'beacon.comment.created';

UPDATE bolt_executions
SET trigger_event = jsonb_set(
  trigger_event,
  '{event_type}',
  to_jsonb('attachment.uploaded'::text),
  false
)
WHERE trigger_event->>'event_type' = 'beacon.attachment.uploaded';

UPDATE bolt_automations
SET trigger_event = 'comment.created'
WHERE trigger_event = 'beacon.comment.created';

UPDATE bolt_automations
SET trigger_event = 'attachment.uploaded'
WHERE trigger_event = 'beacon.attachment.uploaded';
