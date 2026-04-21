-- 0142_banter_thread_broadcast.sql
-- Why: The Banter thread panel UI exposes an "Also send to channel" checkbox
--   on thread replies (apps/banter/src/components/threads/thread-panel.tsx),
--   but the backend had no column to persist that choice and the channel
--   message listing filtered out thread replies unconditionally, so the
--   feature did nothing. Eddie reported the broken behavior on 2026-04-21.
--   Adding a dedicated boolean is cleaner than stuffing a flag into the
--   existing metadata JSONB because the channel-listing query needs to
--   index-scan on it.
-- Client impact: additive only. New column defaults to false, so every
--   existing thread reply stays thread-only. Channel listing query updated
--   in apps/banter-api/src/routes/message.routes.ts to include rows where
--   this flag is true, which is the only behavior change.

-- ──────────────────────────────────────────────────────────────────────
-- Column: banter_messages.also_sent_to_channel
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE banter_messages
  ADD COLUMN IF NOT EXISTS also_sent_to_channel boolean NOT NULL DEFAULT false;

-- ──────────────────────────────────────────────────────────────────────
-- Index to keep channel listing fast
-- ──────────────────────────────────────────────────────────────────────
-- The channel-listing query after this migration is:
--   WHERE channel_id = ? AND is_deleted = false
--     AND (thread_parent_id IS NULL OR also_sent_to_channel = true)
-- A partial index on "broadcast" thread replies keeps the added OR cheap
-- without bloating the non-broadcast case. The existing
-- banter_messages_channel_created_idx still handles the thread_parent_id
-- IS NULL branch.

CREATE INDEX IF NOT EXISTS banter_messages_channel_broadcast_idx
  ON banter_messages(channel_id, created_at)
  WHERE also_sent_to_channel = true;
