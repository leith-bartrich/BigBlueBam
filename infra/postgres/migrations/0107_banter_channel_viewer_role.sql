-- 0107_banter_channel_viewer_role.sql
-- Why: Add viewer role to channel_memberships role enum, enabling read-only channel membership. Schema-level support; UI enforcement is follow-on work.
-- Client impact: additive only. Replaces existing role constraint with one that also accepts 'viewer'.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banter_channel_memberships_role_check') THEN
    ALTER TABLE banter_channel_memberships DROP CONSTRAINT banter_channel_memberships_role_check;
  END IF;
  ALTER TABLE banter_channel_memberships
    ADD CONSTRAINT banter_channel_memberships_role_check
    CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
END $$;
