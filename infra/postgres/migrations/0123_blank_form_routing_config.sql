-- 0123_blank_form_routing_config.sql
-- Why: Add routing_config JSONB column to blank_forms so form submissions
--   can be conditionally routed to Bond contact creation or Helpdesk ticket
--   creation based on per-form configuration.
-- Client impact: additive only

ALTER TABLE blank_forms
  ADD COLUMN IF NOT EXISTS routing_config jsonb;

COMMENT ON COLUMN blank_forms.routing_config IS
  'Optional JSONB routing rules applied after submission. Structure: { rules: [{ condition, action }] }. '
  'action.type can be "bond_contact" or "helpdesk_ticket" with target-specific params.';
