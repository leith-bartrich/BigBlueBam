-- 0122_helpdesk_default_project_backfill.sql
-- Why: Path-based multi-tenant helpdesk routing (see docs/DECISIONS.md D-010)
-- requires helpdesk_settings.default_project_id to resolve deterministically
-- per org. This migration (a) backfills NULL default_project_id rows with the
-- oldest project in the owning org, and (b) upgrades the existing FK to
-- ON DELETE SET NULL so deleting a project no longer orphans helpdesk_settings.
-- Client impact: additive only. Backfill writes NULL -> project_id for rows
-- where default_project_id IS NULL and the org has at least one project;
-- no existing non-NULL values are touched. FK behavior is relaxed (NO ACTION
-- to SET NULL) which only affects the future DELETE-project path.

-- 1. Backfill NULL default_project_id rows with the oldest project per org.
--    Orgs with no projects remain NULL; the API will fall back at ticket
--    creation time and persist the chosen project.
UPDATE helpdesk_settings hs
SET default_project_id = sub.project_id
FROM (
    SELECT DISTINCT ON (p.org_id)
        p.org_id,
        p.id AS project_id
    FROM projects p
    WHERE p.is_archived = false
    ORDER BY p.org_id, p.created_at ASC
) sub
WHERE hs.default_project_id IS NULL
  AND hs.org_id = sub.org_id;

-- 2. Upgrade the existing FK on helpdesk_settings.default_project_id to
--    ON DELETE SET NULL. 0000_init.sql created this FK without an explicit
--    action (defaults to NO ACTION), which would block project deletion if
--    any helpdesk_settings row points at it. SET NULL is safe because the
--    ticket-create path falls back to oldest-project-in-org when this is
--    NULL, and the new admin surface lets org owners re-pick a default.
--    The constraint name in Postgres for an inline REFERENCES without a
--    name is generated as <table>_<col>_fkey. Guard with DO block so reruns
--    on stacks where a previous hand-applied fix already used a different
--    name do not error.
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'helpdesk_settings'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[(
          SELECT attnum FROM pg_attribute
          WHERE attrelid = 'helpdesk_settings'::regclass
            AND attname = 'default_project_id'
      )]
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE helpdesk_settings DROP CONSTRAINT %I', fk_name);
    END IF;

    -- Re-add with the stable name and ON DELETE SET NULL action. IF NOT
    -- EXISTS is not supported on ADD CONSTRAINT, so we catch duplicate_object
    -- for the case where this migration is re-run after a partial apply.
    BEGIN
        ALTER TABLE helpdesk_settings
            ADD CONSTRAINT helpdesk_settings_default_project_id_fkey
            FOREIGN KEY (default_project_id)
            REFERENCES projects(id)
            ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;
