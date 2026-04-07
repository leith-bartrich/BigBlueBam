-- 0023_beacon_tables.sql
-- Why: Phase 1a of Beacon — the knowledge base platform. Creates all
--   relational tables for Beacon entries, versions, tags, links, expiry
--   policies, verifications, agents, and saved queries, along with the
--   ENUMs they depend on.
-- Client impact: additive only — new types, tables, and indexes.

-- ──────────────────────────────────────────────────────────────────────
-- ENUMs
-- ──────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE beacon_status AS ENUM (
        'Draft', 'Active', 'PendingReview', 'Expired', 'Archived', 'Retired'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE beacon_visibility AS ENUM (
        'Public', 'Organization', 'Project', 'Private'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE beacon_link_type AS ENUM (
        'RelatedTo', 'Supersedes', 'DependsOn', 'ConflictsWith', 'SeeAlso'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE expiry_scope AS ENUM (
        'System', 'Organization', 'Project'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_type AS ENUM (
        'Manual', 'AgentAutomatic', 'AgentAssisted', 'ScheduledReview'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_outcome AS ENUM (
        'Confirmed', 'Updated', 'Challenged', 'Retired'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE saved_query_scope AS ENUM (
        'Private', 'Project', 'Organization'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- 1. beacon_entries
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beacon_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(256) UNIQUE NOT NULL,
    title           VARCHAR(512) NOT NULL,
    summary         TEXT,
    body_markdown   TEXT NOT NULL,
    body_html       TEXT,
    version         INTEGER NOT NULL DEFAULT 1,
    status          beacon_status NOT NULL DEFAULT 'Draft',
    visibility      beacon_visibility NOT NULL DEFAULT 'Project',
    created_by      UUID NOT NULL REFERENCES users(id),
    owned_by        UUID NOT NULL REFERENCES users(id),
    project_id      UUID REFERENCES projects(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    last_verified_at    TIMESTAMPTZ,
    last_verified_by    UUID REFERENCES users(id),
    verification_count  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    retired_at      TIMESTAMPTZ,
    vector_id       VARCHAR(128),
    metadata        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_beacon_entries_org_project_status
    ON beacon_entries (organization_id, project_id, status);

CREATE INDEX IF NOT EXISTS idx_beacon_entries_expires_at
    ON beacon_entries (expires_at) WHERE status = 'Active';

CREATE INDEX IF NOT EXISTS idx_beacon_entries_slug
    ON beacon_entries (slug);

CREATE INDEX IF NOT EXISTS idx_beacon_entries_metadata
    ON beacon_entries USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_beacon_entries_fts
    ON beacon_entries USING gin (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(body_markdown, ''))
    );

-- ──────────────────────────────────────────────────────────────────────
-- 2. beacon_agents (before beacon_versions which references it)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beacon_agents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    name                VARCHAR(256) NOT NULL,
    model_identifier    VARCHAR(256),
    organization_id     UUID REFERENCES organizations(id),
    agent_config        JSONB NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beacon_agents_user_id
    ON beacon_agents (user_id);

CREATE INDEX IF NOT EXISTS idx_beacon_agents_org_id
    ON beacon_agents (organization_id);

-- ──────────────────────────────────────────────────────────────────────
-- 3. beacon_versions
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beacon_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beacon_id       UUID NOT NULL REFERENCES beacon_entries(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL,
    title           VARCHAR(512) NOT NULL,
    summary         TEXT,
    body_markdown   TEXT NOT NULL,
    changed_by      UUID REFERENCES users(id),
    changed_by_agent UUID REFERENCES beacon_agents(id),
    change_note     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(beacon_id, version)
);

CREATE INDEX IF NOT EXISTS idx_beacon_versions_beacon_id
    ON beacon_versions (beacon_id);

-- ──────────────────────────────────────────────────────────────────────
-- 4. beacon_tags
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beacon_tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beacon_id       UUID NOT NULL REFERENCES beacon_entries(id) ON DELETE CASCADE,
    tag             VARCHAR(128) NOT NULL,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(beacon_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_beacon_tags_beacon_id
    ON beacon_tags (beacon_id);

CREATE INDEX IF NOT EXISTS idx_beacon_tags_tag
    ON beacon_tags (tag);

-- ──────────────────────────────────────────────────────────────────────
-- 5. beacon_links
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beacon_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID NOT NULL REFERENCES beacon_entries(id) ON DELETE CASCADE,
    target_id       UUID NOT NULL REFERENCES beacon_entries(id) ON DELETE CASCADE,
    link_type       beacon_link_type NOT NULL,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(source_id, target_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_beacon_links_source_id
    ON beacon_links (source_id);

CREATE INDEX IF NOT EXISTS idx_beacon_links_target_id
    ON beacon_links (target_id);

-- ──────────────────────────────────────────────────────────────────────
-- 6. beacon_expiry_policies
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beacon_expiry_policies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope               expiry_scope NOT NULL,
    organization_id     UUID REFERENCES organizations(id),
    project_id          UUID REFERENCES projects(id),
    min_expiry_days     INTEGER NOT NULL,
    max_expiry_days     INTEGER NOT NULL,
    default_expiry_days INTEGER NOT NULL,
    grace_period_days   INTEGER NOT NULL DEFAULT 14,
    set_by              UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(scope, organization_id, project_id),
    CHECK (min_expiry_days <= default_expiry_days),
    CHECK (default_expiry_days <= max_expiry_days),
    CHECK (min_expiry_days > 0)
);

-- ──────────────────────────────────────────────────────────────────────
-- 7. beacon_verifications
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beacon_verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beacon_id           UUID NOT NULL REFERENCES beacon_entries(id) ON DELETE CASCADE,
    verified_by         UUID NOT NULL REFERENCES users(id),
    verification_type   verification_type NOT NULL,
    outcome             verification_outcome NOT NULL,
    confidence_score    REAL,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beacon_verifications_beacon_id
    ON beacon_verifications (beacon_id);

CREATE INDEX IF NOT EXISTS idx_beacon_verifications_verified_by
    ON beacon_verifications (verified_by);

-- ──────────────────────────────────────────────────────────────────────
-- 8. beacon_saved_queries
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beacon_saved_queries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    description         VARCHAR(500),
    query_body          JSONB NOT NULL,
    owner_id            UUID NOT NULL REFERENCES users(id),
    scope               saved_query_scope NOT NULL DEFAULT 'Private',
    project_id          UUID REFERENCES projects(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(owner_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_queries_owner
    ON beacon_saved_queries (owner_id);

CREATE INDEX IF NOT EXISTS idx_saved_queries_scope_org
    ON beacon_saved_queries (scope, organization_id)
    WHERE scope != 'Private';

-- ──────────────────────────────────────────────────────────────────────
-- Seed: system-level default expiry policy (Appendix A)
-- ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM beacon_expiry_policies WHERE scope = 'System'
    ) THEN
        INSERT INTO beacon_expiry_policies (
            id, scope, organization_id, project_id,
            min_expiry_days, max_expiry_days, default_expiry_days, grace_period_days,
            set_by
        ) VALUES (
            gen_random_uuid(), 'System', NULL, NULL,
            7, 365, 90, 14,
            (SELECT id FROM users WHERE is_superuser = true ORDER BY created_at LIMIT 1)
        );
    END IF;
END $$;
