-- 0037_blank_tables.sql
-- Why: Create schema for Blank (Forms & Surveys) — forms, form fields, and submissions.
-- Client impact: additive only

-- ============================================================
-- BLANK: Forms & Surveys
-- ============================================================

-- 1. Forms
CREATE TABLE IF NOT EXISTS blank_forms (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,

    -- Form metadata
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    slug                VARCHAR(60) NOT NULL,

    -- Visibility & access
    form_type           VARCHAR(20) NOT NULL DEFAULT 'public'
                        CHECK (form_type IN ('public', 'internal', 'embedded')),
    requires_login      BOOLEAN NOT NULL DEFAULT false,
    allowed_domains     TEXT[],

    -- Behavior
    accept_responses    BOOLEAN NOT NULL DEFAULT true,
    max_responses       INTEGER,
    one_per_email       BOOLEAN NOT NULL DEFAULT false,
    show_progress_bar   BOOLEAN NOT NULL DEFAULT false,
    shuffle_fields      BOOLEAN NOT NULL DEFAULT false,

    -- Confirmation
    confirmation_type   VARCHAR(20) NOT NULL DEFAULT 'message'
                        CHECK (confirmation_type IN ('message', 'redirect', 'page')),
    confirmation_message TEXT DEFAULT 'Thank you for your submission!',
    confirmation_redirect_url TEXT,

    -- Branding
    header_image_url    TEXT,
    theme_color         VARCHAR(7) DEFAULT '#3b82f6',
    custom_css          TEXT,

    -- Notification
    notify_on_submit    BOOLEAN NOT NULL DEFAULT false,
    notify_emails       TEXT[],
    notify_banter_channel_id UUID,

    -- Rate limiting (public forms)
    rate_limit_per_ip   INTEGER DEFAULT 10,
    captcha_enabled     BOOLEAN NOT NULL DEFAULT false,

    -- Status
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'closed', 'archived')),
    published_at        TIMESTAMPTZ,
    closed_at           TIMESTAMPTZ,

    -- Metadata
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE blank_forms ADD CONSTRAINT blank_forms_org_slug_unique UNIQUE (organization_id, slug);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_blank_forms_org ON blank_forms(organization_id);
CREATE INDEX IF NOT EXISTS idx_blank_forms_slug ON blank_forms(slug) WHERE status = 'published';

-- 2. Form fields (ordered list of questions/inputs)
CREATE TABLE IF NOT EXISTS blank_form_fields (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id             UUID NOT NULL REFERENCES blank_forms(id) ON DELETE CASCADE,

    -- Field definition
    field_key           VARCHAR(60) NOT NULL,
    label               VARCHAR(500) NOT NULL,
    description         TEXT,
    placeholder         VARCHAR(255),
    field_type          VARCHAR(30) NOT NULL
                        CHECK (field_type IN (
                            'short_text', 'long_text', 'email', 'phone', 'url', 'number',
                            'single_select', 'multi_select', 'dropdown',
                            'date', 'time', 'datetime',
                            'file_upload', 'image_upload',
                            'rating', 'scale', 'nps',
                            'checkbox', 'toggle',
                            'section_header', 'paragraph',
                            'hidden'
                        )),

    -- Validation
    required            BOOLEAN NOT NULL DEFAULT false,
    min_length          INTEGER,
    max_length          INTEGER,
    min_value           NUMERIC,
    max_value           NUMERIC,
    regex_pattern       VARCHAR(255),

    -- Options (for select/dropdown types)
    options             JSONB,

    -- Rating/scale config
    scale_min           INTEGER DEFAULT 1,
    scale_max           INTEGER DEFAULT 5,
    scale_min_label     VARCHAR(100),
    scale_max_label     VARCHAR(100),

    -- File upload config
    allowed_file_types  TEXT[],
    max_file_size_mb    INTEGER DEFAULT 10,

    -- Conditional logic
    conditional_on_field_id UUID REFERENCES blank_form_fields(id),
    conditional_operator VARCHAR(20) CHECK (conditional_operator IN ('equals', 'not_equals', 'contains', 'gt', 'lt', 'is_set', 'is_not_set')),
    conditional_value   TEXT,

    -- Layout
    sort_order          INTEGER NOT NULL DEFAULT 0,
    page_number         INTEGER NOT NULL DEFAULT 1,
    column_span         INTEGER NOT NULL DEFAULT 1
                        CHECK (column_span IN (1, 2)),

    -- Default value
    default_value       TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blank_fields_form ON blank_form_fields(form_id, sort_order);

-- 3. Submissions
CREATE TABLE IF NOT EXISTS blank_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id             UUID NOT NULL REFERENCES blank_forms(id) ON DELETE CASCADE,
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Response data (JSONB keyed by field_key)
    response_data       JSONB NOT NULL,

    -- Submitter info
    submitted_by_user_id UUID REFERENCES users(id),
    submitted_by_email  VARCHAR(255),
    submitted_by_ip     INET,
    user_agent          TEXT,

    -- File attachments
    attachments         JSONB DEFAULT '[]',

    -- Processing status
    processed           BOOLEAN NOT NULL DEFAULT false,

    -- Metadata
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blank_submissions_form ON blank_submissions(form_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_blank_submissions_org ON blank_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_blank_submissions_email ON blank_submissions(submitted_by_email);
CREATE INDEX IF NOT EXISTS idx_blank_submissions_data ON blank_submissions USING GIN (response_data);
