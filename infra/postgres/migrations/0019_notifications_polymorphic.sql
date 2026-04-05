-- ─────────────────────────────────────────────────────────────────────────
-- 0019_notifications_polymorphic.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Client impact: additive only (five nullable/defaulted columns + two
--                indexes + one CHECK). Also fixes a pre-existing bug
--                where the worker's banter-notification job insert was
--                silently failing due to a missing `metadata` column.
-- Why: BigBlueBam and Banter both need to surface user-facing events
--      (task mentions, DMs, thread replies, etc.) through a SINGLE bell
--      in each app's header. To unify that inbox we need the existing
--      `notifications` table to carry origin + routing info:
--        - `source_app`   which app produced the event ('bbb'|'banter'|
--                         'helpdesk') so the frontend can badge/filter.
--        - `deep_link`    absolute URL path the client navigates to on
--                         click (e.g. '/b3/projects/<id>/board?task=<id>',
--                         '/banter/channels/<slug>', '/banter/dm/<id>').
--        - `category`     normalized event kind, decoupled from the
--                         existing free-form `type` column ('mention',
--                         'dm', 'thread_reply', 'task_comment',
--                         'task_assigned', 'status_change', ...).
--        - `metadata`     JSONB blob for per-source context (channel_id,
--                         message_id, thread_parent_id, task_id, ...).
--                         NOTE: the worker's banter-notification job
--                         already writes to `metadata`; that INSERT has
--                         been silently failing because the column did
--                         not exist. Adding it fixes that bug.
--        - `org_id`       scoping column so the bell can filter to the
--                         user's ACTIVE org in multi-org deployments.
--
-- Client impact: additive only. All five columns are nullable or have
--      defaults. Existing rows backfill with source_app='bbb' and a
--      NULL deep_link/category (the BBB frontend already renders
--      pre-polymorphic rows via project_id/task_id and type; those
--      code paths continue to work untouched).
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS source_app text NOT NULL DEFAULT 'bbb',
  ADD COLUMN IF NOT EXISTS deep_link  text,
  ADD COLUMN IF NOT EXISTS category   text,
  ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill existing rows: every pre-0019 notification originated in BBB.
UPDATE notifications SET source_app = 'bbb' WHERE source_app IS NULL;

-- Constrain source_app to the known app set. Helpdesk is listed
-- preemptively so the helpdesk API can opt into the shared bell later
-- without another migration.
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_source_app_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_source_app_check
  CHECK (source_app IN ('bbb', 'banter', 'helpdesk'));

-- Filter index for "show me unread Banter notifications" and
-- "show me notifications of category=mention" style queries.
CREATE INDEX IF NOT EXISTS idx_notifications_user_source_unread
  ON notifications (user_id, source_app, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_category
  ON notifications (user_id, category, created_at DESC)
  WHERE category IS NOT NULL;
