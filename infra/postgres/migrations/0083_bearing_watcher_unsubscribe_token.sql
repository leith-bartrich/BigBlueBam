-- 0083_bearing_watcher_unsubscribe_token.sql
-- Why: Support one-click unsubscribe link in watcher notification emails without requiring login.
-- Client impact: additive only. New nullable column; email generation populates it lazily.

ALTER TABLE bearing_goal_watchers
  ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_bearing_goal_watchers_unsubscribe_token
  ON bearing_goal_watchers (unsubscribe_token)
  WHERE unsubscribe_token IS NOT NULL;
