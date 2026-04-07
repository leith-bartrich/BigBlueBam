-- 0027_llm_providers.sql
-- Why: Create the llm_providers table for hierarchical LLM provider configuration.
--   SuperUsers define system-wide providers, org admins set org-level, project leads
--   set project-level overrides. Resolution walks project -> org -> system.
-- Client impact: additive only

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS llm_providers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scope: exactly one of (system, organization, project)
    scope                   VARCHAR(20) NOT NULL CHECK (scope IN ('system', 'organization', 'project')),
    organization_id         UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_id              UUID REFERENCES projects(id) ON DELETE CASCADE,

    -- Provider configuration
    name                    VARCHAR(100) NOT NULL,
    provider_type           VARCHAR(30) NOT NULL CHECK (provider_type IN ('anthropic', 'openai', 'openai_compatible')),
    model_id                VARCHAR(200) NOT NULL,

    -- Connection details
    api_endpoint            VARCHAR(2048),
    api_key_encrypted       BYTEA NOT NULL,

    -- Configuration
    max_tokens              INTEGER DEFAULT 4096,
    temperature             NUMERIC(3,2) DEFAULT 0.7,
    is_default              BOOLEAN NOT NULL DEFAULT false,
    enabled                 BOOLEAN NOT NULL DEFAULT true,

    -- Usage limits
    max_requests_per_hour   INTEGER DEFAULT 100,
    max_tokens_per_hour     INTEGER DEFAULT 500000,

    -- Metadata
    created_by              UUID NOT NULL REFERENCES users(id),
    updated_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_llm_providers_scope
    ON llm_providers(scope, organization_id, project_id);

CREATE INDEX IF NOT EXISTS idx_llm_providers_org
    ON llm_providers(organization_id) WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_llm_providers_project
    ON llm_providers(project_id) WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_llm_providers_default
    ON llm_providers(scope, organization_id, project_id, is_default) WHERE is_default = true;
