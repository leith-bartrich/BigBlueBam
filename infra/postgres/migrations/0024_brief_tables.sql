-- 0024_brief_tables.sql
-- Why: Phase 1 of Brief — the collaborative document editor. Creates all
--   relational tables for documents, folders, versions, comments, embeds,
--   templates, cross-product links, collaborators, and stars.
-- Client impact: additive only — new types, tables, and indexes.

-- ──────────────────────────────────────────────────────────────────────
-- ENUMs
-- ──────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE brief_document_status AS ENUM (
        'draft', 'in_review', 'approved', 'archived'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE brief_visibility AS ENUM (
        'private', 'project', 'organization'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE brief_task_link_type AS ENUM (
        'reference', 'spec', 'notes', 'postmortem'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE brief_beacon_link_type AS ENUM (
        'reference', 'source', 'related'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE brief_collaborator_permission AS ENUM (
        'view', 'comment', 'edit'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- 1. brief_templates (before documents, which reference templates)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    icon            VARCHAR(100),
    category        VARCHAR(100),
    yjs_state       BYTEA,
    html_preview    TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brief_templates_org_id
    ON brief_templates (org_id);

CREATE INDEX IF NOT EXISTS idx_brief_templates_category
    ON brief_templates (category);

-- ──────────────────────────────────────────────────────────────────────
-- 2. brief_folders
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_folders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES brief_folders(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(300) NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brief_folders_org_project
    ON brief_folders (org_id, project_id);

CREATE INDEX IF NOT EXISTS idx_brief_folders_parent_id
    ON brief_folders (parent_id);

CREATE INDEX IF NOT EXISTS idx_brief_folders_slug
    ON brief_folders (slug);

-- ──────────────────────────────────────────────────────────────────────
-- 3. brief_documents
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,
    folder_id           UUID REFERENCES brief_folders(id) ON DELETE SET NULL,
    title               VARCHAR(512) NOT NULL DEFAULT 'Untitled',
    slug                VARCHAR(300) UNIQUE NOT NULL,
    yjs_state           BYTEA,
    plain_text          TEXT,
    html_snapshot       TEXT,
    icon                VARCHAR(100),
    cover_image_url     TEXT,
    template_id         UUID REFERENCES brief_templates(id) ON DELETE SET NULL,
    status              brief_document_status NOT NULL DEFAULT 'draft',
    visibility          brief_visibility NOT NULL DEFAULT 'project',
    pinned              BOOLEAN NOT NULL DEFAULT false,
    word_count          INTEGER NOT NULL DEFAULT 0,
    promoted_to_beacon_id UUID REFERENCES beacon_entries(id) ON DELETE SET NULL,
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_brief_documents_org_project_status
    ON brief_documents (org_id, project_id, status);

CREATE INDEX IF NOT EXISTS idx_brief_documents_folder_id
    ON brief_documents (folder_id);

CREATE INDEX IF NOT EXISTS idx_brief_documents_slug
    ON brief_documents (slug);

CREATE INDEX IF NOT EXISTS idx_brief_documents_created_by
    ON brief_documents (created_by);

CREATE INDEX IF NOT EXISTS idx_brief_documents_updated_at
    ON brief_documents (updated_at);

CREATE INDEX IF NOT EXISTS idx_brief_documents_fts
    ON brief_documents USING gin (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(plain_text, ''))
    );

-- ──────────────────────────────────────────────────────────────────────
-- 4. brief_versions
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES brief_documents(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    title           VARCHAR(512) NOT NULL,
    yjs_state       BYTEA,
    html_snapshot   TEXT,
    plain_text      TEXT,
    word_count      INTEGER NOT NULL DEFAULT 0,
    change_summary  TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_brief_versions_document_id
    ON brief_versions (document_id);

-- ──────────────────────────────────────────────────────────────────────
-- 5. brief_comments
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES brief_documents(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES brief_comments(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id),
    body            TEXT NOT NULL,
    anchor_start    JSONB,
    anchor_end      JSONB,
    anchor_text     TEXT,
    resolved        BOOLEAN NOT NULL DEFAULT false,
    resolved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brief_comments_document_id
    ON brief_comments (document_id);

CREATE INDEX IF NOT EXISTS idx_brief_comments_parent_id
    ON brief_comments (parent_id);

-- ──────────────────────────────────────────────────────────────────────
-- 6. brief_comment_reactions
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_comment_reactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id      UUID NOT NULL REFERENCES brief_comments(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    emoji           VARCHAR(32) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_brief_comment_reactions_comment_id
    ON brief_comment_reactions (comment_id);

-- ──────────────────────────────────────────────────────────────────────
-- 7. brief_embeds
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_embeds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES brief_documents(id) ON DELETE CASCADE,
    file_name       VARCHAR(500) NOT NULL,
    file_size       BIGINT NOT NULL,
    mime_type       VARCHAR(255) NOT NULL,
    storage_key     TEXT NOT NULL,
    width           INTEGER,
    height          INTEGER,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brief_embeds_document_id
    ON brief_embeds (document_id);

-- ──────────────────────────────────────────────────────────────────────
-- 8. brief_task_links
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_task_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES brief_documents(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    link_type       brief_task_link_type NOT NULL DEFAULT 'reference',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, task_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_brief_task_links_document_id
    ON brief_task_links (document_id);

CREATE INDEX IF NOT EXISTS idx_brief_task_links_task_id
    ON brief_task_links (task_id);

-- ──────────────────────────────────────────────────────────────────────
-- 9. brief_beacon_links
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_beacon_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES brief_documents(id) ON DELETE CASCADE,
    beacon_id       UUID NOT NULL REFERENCES beacon_entries(id) ON DELETE CASCADE,
    link_type       brief_beacon_link_type NOT NULL DEFAULT 'reference',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, beacon_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_brief_beacon_links_document_id
    ON brief_beacon_links (document_id);

CREATE INDEX IF NOT EXISTS idx_brief_beacon_links_beacon_id
    ON brief_beacon_links (beacon_id);

-- ──────────────────────────────────────────────────────────────────────
-- 10. brief_collaborators
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_collaborators (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES brief_documents(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    permission      brief_collaborator_permission NOT NULL DEFAULT 'view',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_brief_collaborators_document_id
    ON brief_collaborators (document_id);

CREATE INDEX IF NOT EXISTS idx_brief_collaborators_user_id
    ON brief_collaborators (user_id);

-- ──────────────────────────────────────────────────────────────────────
-- 11. brief_stars
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_stars (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES brief_documents(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_brief_stars_document_id
    ON brief_stars (document_id);

CREATE INDEX IF NOT EXISTS idx_brief_stars_user_id
    ON brief_stars (user_id);
