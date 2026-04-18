-- 0130_task_external_id.sql
-- Why: Wave 4 AGENTIC_TODO §14. Enables idempotent task creation from webhook/import flows by (project_id, external_id). Also adds a partial unique index on bond_contacts(organization_id, lower(email)) so bond_upsert_contact can rely on DB-level ON CONFLICT semantics.
-- Client impact: additive only when duplicate bond contacts do not already exist. The DO-block below pre-checks for duplicates and fails loudly with a cleanup message if they do.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_project_external_id_uniq
  ON tasks(project_id, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_external_id
  ON tasks(external_id) WHERE external_id IS NOT NULL;

DO $$
DECLARE dup_count int;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT organization_id, lower(email) FROM bond_contacts
    WHERE email IS NOT NULL AND deleted_at IS NULL
    GROUP BY 1,2 HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'bond_contacts has % duplicate (organization_id, lower(email)) pairs. Resolve with bond merge tooling before applying migration 0130.', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bond_contacts_org_lower_email_uniq
  ON bond_contacts(organization_id, lower(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;
