-- 0110_helpdesk_users_org_id_constraint.sql
-- Why: Contract phase of org_id rollout. Add FK and replace global UNIQUE(email) with per-org UNIQUE(org_id, email).
-- Client impact: expand-contract step 2 of 2. Rows with NULL org_id remain; application prompts re-registration.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_users_org_id_fk') THEN
    ALTER TABLE helpdesk_users
      ADD CONSTRAINT helpdesk_users_org_id_fk FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE helpdesk_users DROP CONSTRAINT IF EXISTS helpdesk_users_email_key;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_users_org_id_email_unique') THEN
    ALTER TABLE helpdesk_users
      ADD CONSTRAINT helpdesk_users_org_id_email_unique UNIQUE (org_id, email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_helpdesk_users_org_id_email ON helpdesk_users (org_id, email);
