-- 0105_banter_user_presence.sql
-- Why: Add real-time user presence tracking table for status broadcast (online, idle, in_call, dnd, offline). Powers presence indicators in sidebar and call UI.
-- Client impact: additive only. New table.

CREATE TABLE IF NOT EXISTS banter_user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  in_call_channel_id UUID REFERENCES banter_channels(id) ON DELETE SET NULL,
  custom_status_text VARCHAR(200),
  custom_status_emoji VARCHAR(10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banter_user_presence_status_check') THEN
    ALTER TABLE banter_user_presence
      ADD CONSTRAINT banter_user_presence_status_check
      CHECK (status IN ('online', 'idle', 'in_call', 'dnd', 'offline'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_banter_user_presence_user ON banter_user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_banter_user_presence_status ON banter_user_presence(status) WHERE status != 'offline';
