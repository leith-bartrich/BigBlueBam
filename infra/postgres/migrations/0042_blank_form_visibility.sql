-- 0042_blank_form_visibility.sql
-- Why: Blank forms need optional expiration and a dedicated visibility control
--      (public / org / project) separate from the loose form_type presentation
--      hint, so private forms can be gated on org or project membership and
--      forms can auto-close after a date.
-- Client impact: additive only.

ALTER TABLE blank_forms
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE blank_forms
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'org', 'project'));

CREATE INDEX IF NOT EXISTS idx_blank_forms_expires_at
  ON blank_forms(expires_at)
  WHERE expires_at IS NOT NULL;
