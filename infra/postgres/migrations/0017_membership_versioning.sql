-- ─────────────────────────────────────────────────────────────────────────
-- 0017_membership_versioning.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: P1-25 (permissions audit) — two admins editing the same member's
--      role concurrently produces last-write-wins silently, and in the
--      worst case a demotion is clobbered by an unrelated promotion. We
--      add a `version` column to `organization_memberships` so the service
--      layer can enforce optimistic concurrency (SET ... WHERE
--      version = :expected_version, incrementing on each write). A 0-row
--      UPDATE signals a VERSION_CONFLICT that the caller must resolve by
--      re-reading the membership.
-- Client impact: additive only. Column defaults to 1 for every existing
--      row, so any client that fetches a membership today sees a
--      predictable starting version. The `expected_version` parameter on
--      the PATCH endpoints is optional — clients that don't send it
--      behave exactly as before (last-write-wins) but the server still
--      bumps `version` on every write so opted-in clients stay correct
--      even when racing against opted-out clients.
ALTER TABLE organization_memberships
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
