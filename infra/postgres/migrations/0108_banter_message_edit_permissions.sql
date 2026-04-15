-- 0108_banter_message_edit_permissions.sql
-- Why: Add edit_permission column to messages to track who can edit. Schema-level support; UI enforcement is follow-on work.
-- Client impact: additive only. Existing rows default to 'own'.

ALTER TABLE banter_messages
  ADD COLUMN IF NOT EXISTS edit_permission VARCHAR(20) NOT NULL DEFAULT 'own';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banter_messages_edit_permission_check') THEN
    ALTER TABLE banter_messages
      ADD CONSTRAINT banter_messages_edit_permission_check
      CHECK (edit_permission IN ('own', 'thread_starter', 'none'));
  END IF;
END $$;
