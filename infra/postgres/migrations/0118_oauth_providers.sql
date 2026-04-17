-- 0118_oauth_providers.sql
-- Why: OAuth provider registry. Stores client credentials and configuration for GitHub, Google, and future providers. Backed by the api service's oauth plugin which reads provider rows on every /auth/oauth/* request.
-- Client impact: additive only. New table.

CREATE TABLE IF NOT EXISTS oauth_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name VARCHAR(50) NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  authorization_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  user_info_url TEXT NOT NULL,
  scopes TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_providers_name ON oauth_providers(provider_name);
