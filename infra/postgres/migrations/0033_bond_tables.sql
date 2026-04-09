-- 0033_bond_tables.sql
-- Why: Create the 11 core tables for Bond (CRM) — contacts, companies,
--   pipelines, deals, activities, stage history, lead scoring rules, and
--   custom field definitions.
-- Client impact: additive only — new tables and indexes.

-- ============================================================
-- BOND: Customer Relationship Management
-- ============================================================

-- 1. bond_contacts
CREATE TABLE IF NOT EXISTS bond_contacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    first_name          VARCHAR(100),
    last_name           VARCHAR(100),
    email               VARCHAR(255),
    phone               VARCHAR(50),
    title               VARCHAR(150),
    avatar_url          TEXT,

    lifecycle_stage     VARCHAR(30) NOT NULL DEFAULT 'lead'
                        CHECK (lifecycle_stage IN (
                            'subscriber', 'lead', 'marketing_qualified',
                            'sales_qualified', 'opportunity', 'customer',
                            'evangelist', 'other'
                        )),
    lead_source         VARCHAR(60),
    lead_score          INTEGER DEFAULT 0,

    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    city                VARCHAR(100),
    state_region        VARCHAR(100),
    postal_code         VARCHAR(20),
    country             VARCHAR(2),

    custom_fields       JSONB DEFAULT '{}',

    owner_id            UUID REFERENCES users(id) ON DELETE SET NULL,

    last_contacted_at   TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bond_contacts_org ON bond_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_bond_contacts_email ON bond_contacts(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_bond_contacts_lifecycle ON bond_contacts(organization_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_bond_contacts_owner ON bond_contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_bond_contacts_score ON bond_contacts(organization_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_bond_contacts_custom ON bond_contacts USING GIN (custom_fields);

-- 2. bond_companies
CREATE TABLE IF NOT EXISTS bond_companies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name                VARCHAR(255) NOT NULL,
    domain              VARCHAR(255),
    industry            VARCHAR(100),
    size_bucket         VARCHAR(30)
                        CHECK (size_bucket IN ('1-10', '11-50', '51-200', '201-1000', '1001-5000', '5000+')),
    annual_revenue      BIGINT,
    phone               VARCHAR(50),
    website             TEXT,
    logo_url            TEXT,

    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    city                VARCHAR(100),
    state_region        VARCHAR(100),
    postal_code         VARCHAR(20),
    country             VARCHAR(2),

    custom_fields       JSONB DEFAULT '{}',
    owner_id            UUID REFERENCES users(id) ON DELETE SET NULL,

    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bond_companies_org ON bond_companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_bond_companies_domain ON bond_companies(organization_id, domain);
CREATE INDEX IF NOT EXISTS idx_bond_companies_name ON bond_companies(organization_id, name);

-- 3. bond_contact_companies (many-to-many)
CREATE TABLE IF NOT EXISTS bond_contact_companies (
    contact_id          UUID NOT NULL REFERENCES bond_contacts(id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES bond_companies(id) ON DELETE CASCADE,
    role_at_company     VARCHAR(100),
    is_primary          BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contact_id, company_id)
);

-- 4. bond_pipelines
CREATE TABLE IF NOT EXISTS bond_pipelines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    is_default          BOOLEAN NOT NULL DEFAULT false,
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bond_pipelines_org ON bond_pipelines(organization_id);

-- 5. bond_pipeline_stages
CREATE TABLE IF NOT EXISTS bond_pipeline_stages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id         UUID NOT NULL REFERENCES bond_pipelines(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    stage_type          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (stage_type IN ('active', 'won', 'lost')),
    probability_pct     INTEGER DEFAULT 0
                        CHECK (probability_pct BETWEEN 0 AND 100),
    rotting_days        INTEGER,
    color               VARCHAR(7),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bond_stages_pipeline ON bond_pipeline_stages(pipeline_id, sort_order);

-- 6. bond_deals
CREATE TABLE IF NOT EXISTS bond_deals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    pipeline_id         UUID NOT NULL REFERENCES bond_pipelines(id) ON DELETE RESTRICT,
    stage_id            UUID NOT NULL REFERENCES bond_pipeline_stages(id) ON DELETE RESTRICT,

    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    value               BIGINT,
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    expected_close_date DATE,
    probability_pct     INTEGER
                        CHECK (probability_pct BETWEEN 0 AND 100),
    weighted_value      BIGINT GENERATED ALWAYS AS (
                            CASE WHEN value IS NOT NULL AND probability_pct IS NOT NULL
                                 THEN (value * probability_pct) / 100
                                 ELSE NULL END
                        ) STORED,

    closed_at           TIMESTAMPTZ,
    close_reason        TEXT,
    lost_to_competitor  VARCHAR(255),

    owner_id            UUID REFERENCES users(id) ON DELETE SET NULL,
    company_id          UUID REFERENCES bond_companies(id) ON DELETE SET NULL,

    custom_fields       JSONB DEFAULT '{}',

    stage_entered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at    TIMESTAMPTZ,

    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bond_deals_org ON bond_deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_bond_deals_pipeline ON bond_deals(pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_bond_deals_owner ON bond_deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_bond_deals_company ON bond_deals(company_id);
CREATE INDEX IF NOT EXISTS idx_bond_deals_close ON bond_deals(expected_close_date) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bond_deals_stale ON bond_deals(stage_entered_at) WHERE closed_at IS NULL;

-- 7. bond_deal_contacts (many-to-many)
CREATE TABLE IF NOT EXISTS bond_deal_contacts (
    deal_id             UUID NOT NULL REFERENCES bond_deals(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES bond_contacts(id) ON DELETE CASCADE,
    role                VARCHAR(60),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (deal_id, contact_id)
);

-- 8. bond_activities
CREATE TABLE IF NOT EXISTS bond_activities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    contact_id          UUID REFERENCES bond_contacts(id) ON DELETE CASCADE,
    deal_id             UUID REFERENCES bond_deals(id) ON DELETE CASCADE,
    company_id          UUID REFERENCES bond_companies(id) ON DELETE CASCADE,

    activity_type       VARCHAR(30) NOT NULL
                        CHECK (activity_type IN (
                            'note', 'email_sent', 'email_received',
                            'call', 'meeting', 'task', 'stage_change',
                            'deal_created', 'deal_won', 'deal_lost',
                            'contact_created', 'form_submission',
                            'campaign_sent', 'campaign_opened', 'campaign_clicked',
                            'custom'
                        )),
    subject             VARCHAR(255),
    body                TEXT,
    metadata            JSONB DEFAULT '{}',

    performed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bond_activities_contact ON bond_activities(contact_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bond_activities_deal ON bond_activities(deal_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bond_activities_company ON bond_activities(company_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bond_activities_org ON bond_activities(organization_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bond_activities_type ON bond_activities(activity_type);

-- 9. bond_deal_stage_history
CREATE TABLE IF NOT EXISTS bond_deal_stage_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id             UUID NOT NULL REFERENCES bond_deals(id) ON DELETE CASCADE,
    from_stage_id       UUID REFERENCES bond_pipeline_stages(id),
    to_stage_id         UUID NOT NULL REFERENCES bond_pipeline_stages(id),
    changed_by          UUID REFERENCES users(id),
    changed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_in_stage   INTERVAL
);

CREATE INDEX IF NOT EXISTS idx_bond_stage_history_deal ON bond_deal_stage_history(deal_id, changed_at DESC);

-- 10. bond_lead_scoring_rules
CREATE TABLE IF NOT EXISTS bond_lead_scoring_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    condition_field     VARCHAR(100) NOT NULL,
    condition_operator  VARCHAR(20) NOT NULL
                        CHECK (condition_operator IN ('equals', 'not_equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'exists', 'not_exists')),
    condition_value     TEXT NOT NULL,
    score_delta         INTEGER NOT NULL,
    enabled             BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bond_scoring_org ON bond_lead_scoring_rules(organization_id) WHERE enabled = true;

-- 11. bond_custom_field_definitions
CREATE TABLE IF NOT EXISTS bond_custom_field_definitions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type         VARCHAR(20) NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
    field_key           VARCHAR(60) NOT NULL,
    label               VARCHAR(100) NOT NULL,
    field_type          VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'multi_select', 'url', 'email', 'phone', 'boolean')),
    options             JSONB,
    required            BOOLEAN NOT NULL DEFAULT false,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, entity_type, field_key)
);
