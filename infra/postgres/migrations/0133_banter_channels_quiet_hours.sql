-- 0133_banter_channels_quiet_hours.sql
-- Why: Wave 4 AGENTIC_TODO §13. Adds per-channel quiet-hours policy so
--   scheduled and immediate posts respect channel DND windows without every
--   agent reimplementing timezone arithmetic. Adds a scheduled-messages table
--   so delayed posts survive Redis flushes.
-- Client impact: additive only. New column is nullable. New table is empty at
--   creation.

ALTER TABLE banter_channels ADD COLUMN IF NOT EXISTS quiet_hours_policy jsonb;

CREATE TABLE IF NOT EXISTS banter_scheduled_messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_id           uuid NOT NULL REFERENCES banter_channels(id) ON DELETE CASCADE,
  author_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content              text NOT NULL,
  content_format       varchar(20) NOT NULL DEFAULT 'html',
  thread_parent_id     uuid,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at         timestamptz NOT NULL,
  status               varchar(20) NOT NULL DEFAULT 'pending',
  delivered_message_id uuid,
  defer_reason         varchar(40),
  bullmq_job_id        varchar(64),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  delivered_at         timestamptz,
  cancelled_at         timestamptz,
  CHECK (status IN ('pending','delivered','cancelled','failed'))
);

CREATE INDEX IF NOT EXISTS idx_banter_scheduled_channel_status
  ON banter_scheduled_messages(channel_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_banter_scheduled_pending_time
  ON banter_scheduled_messages(scheduled_at) WHERE status = 'pending';

DROP TRIGGER IF EXISTS banter_scheduled_messages_set_updated_at ON banter_scheduled_messages;
CREATE TRIGGER banter_scheduled_messages_set_updated_at
  BEFORE UPDATE ON banter_scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE banter_scheduled_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS banter_scheduled_messages_org_isolation ON banter_scheduled_messages;
CREATE POLICY banter_scheduled_messages_org_isolation ON banter_scheduled_messages
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);
