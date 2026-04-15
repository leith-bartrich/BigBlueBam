-- 0119_oauth_user_links.sql
-- Why: Track links between local users and their external OAuth accounts. Supports multi-provider linking per user so a single user can sign in via GitHub and Google simultaneously.
-- Client impact: additive only. New table.

CREATE TABLE IF NOT EXISTS oauth_user_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name VARCHAR(50) NOT NULL,
  external_id TEXT NOT NULL,
  external_email TEXT NOT NULL,
  external_login TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT oauth_user_links_provider_external_id_unique UNIQUE (provider_name, external_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user_links_provider_external
  ON oauth_user_links(provider_name, external_id);

CREATE INDEX IF NOT EXISTS idx_oauth_user_links_user
  ON oauth_user_links(user_id);
