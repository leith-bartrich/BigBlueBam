-- 0143_board_project_org_alignment.sql
-- Why: Board.create / Board.update accepted any UUID as project_id with no
-- check that the project actually lived in the same org as the board. The
-- frontend project store also persists `activeProjectId` to localStorage and
-- is not cleared on org switch, so a SuperUser context-switch from org A to
-- org B leaves the prior org's project id in place; the next createBoard
-- POST sends that stale id, the backend accepts it, and the board ends up
-- pointing at a project from a different org. Two boards in the live local
-- DB ("BoardBoard", "SailBoard") were created this way. This migration
-- adds a DB-level trigger that prevents the misalignment regardless of how
-- it was reached, and one-time-detaches every existing board whose
-- project_id resolves to a project in a different org.
-- Client impact: additive only. Existing boards without a project_id (or
-- with a properly-aligned project_id) are untouched. Misaligned boards get
-- their project_id set to NULL and an audit row written so the alert UX
-- can offer the user a re-attach to a project in the right org.

-- ─── 1. Trigger function ──────────────────────────────────────────────────
-- Fires BEFORE INSERT OR UPDATE OF project_id, organization_id on boards.
-- Skips the check when project_id is NULL (an unattached board is always
-- valid). Looks up projects.org_id and raises if it disagrees with the
-- board's organization_id. SECURITY DEFINER is NOT used — this runs in
-- the calling role's context, which means it respects RLS on projects;
-- if the caller can't see the project at all, the lookup returns nothing
-- and the trigger raises with a clear message rather than the cryptic
-- generic FK error.

CREATE OR REPLACE FUNCTION boards_project_org_alignment_check()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
DECLARE
  v_project_org uuid;
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT org_id INTO v_project_org FROM projects WHERE id = NEW.project_id;

  IF v_project_org IS NULL THEN
    RAISE EXCEPTION
      'PROJECT_NOT_FOUND: project_id % does not exist', NEW.project_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_project_org <> NEW.organization_id THEN
    RAISE EXCEPTION
      'PROJECT_ORG_MISMATCH: board.organization_id=% but project.org_id=% for project_id=%',
      NEW.organization_id, v_project_org, NEW.project_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 2. Drop-and-recreate the trigger so the migration is idempotent ──────
-- DROP IF EXISTS makes a re-run safe; nothing depends on the trigger's OID.

DROP TRIGGER IF EXISTS boards_project_org_alignment_check_trg ON boards;

CREATE TRIGGER boards_project_org_alignment_check_trg
  BEFORE INSERT OR UPDATE OF project_id, organization_id ON boards
  FOR EACH ROW
  EXECUTE FUNCTION boards_project_org_alignment_check();

-- ─── 3. One-time backfill — detach already-misaligned boards ──────────────
-- We do NOT delete the board, only its project_id, so the user can
-- re-attach it to a project in the right org via the alert UX. The
-- audit log captures the previous project_id so an operator can
-- reconstruct the original intent if needed (e.g. "this board was
-- attached to a Mage project before the cleanup").

CREATE TABLE IF NOT EXISTS board_integrity_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  issue_code varchar(64) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  remediation varchar(64),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS board_integrity_audit_board_idx ON board_integrity_audit (board_id);
CREATE INDEX IF NOT EXISTS board_integrity_audit_created_idx ON board_integrity_audit (created_at DESC);

-- Capture the misaligned set BEFORE we mutate anything so the audit
-- writes have access to the original project_id.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT b.id AS board_id, b.organization_id AS board_org_id, b.project_id, p.org_id AS project_org_id
    FROM boards b
    JOIN projects p ON p.id = b.project_id
    WHERE b.organization_id <> p.org_id
  LOOP
    INSERT INTO board_integrity_audit (board_id, issue_code, details, remediation)
    VALUES (
      r.board_id,
      'PROJECT_ORG_MISMATCH',
      jsonb_build_object(
        'previous_project_id', r.project_id,
        'previous_project_org_id', r.project_org_id,
        'board_org_id', r.board_org_id
      ),
      'auto_detached_by_migration_0143'
    );

    -- Detach. The trigger above is now active, so we have to update via
    -- a path the trigger will accept — setting project_id = NULL bypasses
    -- the alignment check (NULL project_id is always valid).
    UPDATE boards SET project_id = NULL WHERE id = r.board_id;
  END LOOP;
END
$$;
