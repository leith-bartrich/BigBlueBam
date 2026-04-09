-- 0034_blast_tables.sql
-- Why: Create the 7 core tables for Blast (Email Campaigns & Marketing
--   Automation) — templates, segments, campaigns, send log, engagement
--   events, unsubscribes, and sender domains.
-- Client impact: additive only — new tables and indexes.

-- ============================================================
-- BLAST: Email Campaigns & Marketing Automation
-- ============================================================

-- 1. blast_templates — reusable email templates
CREATE TABLE IF NOT EXISTS blast_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    -- Template content
    subject_template    VARCHAR(500) NOT NULL,
    html_body           TEXT NOT NULL,
    json_design         JSONB,
    plain_text_body     TEXT,
    -- Template type
    template_type       VARCHAR(20) NOT NULL DEFAULT 'campaign'
                        CHECK (template_type IN ('campaign', 'drip_step', 'transactional', 'system')),
    -- Thumbnail preview
    thumbnail_url       TEXT,
    -- Versioning
    version             INTEGER NOT NULL DEFAULT 1,
    -- Metadata
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blast_templates_org ON blast_templates(organization_id);

-- 2. blast_segments — saved filters over Bond contacts
CREATE TABLE IF NOT EXISTS blast_segments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    -- Filter definition
    filter_criteria     JSONB NOT NULL,
    cached_count        INTEGER,
    cached_at           TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blast_segments_org ON blast_segments(organization_id);

-- 3. blast_campaigns — a specific email send
CREATE TABLE IF NOT EXISTS blast_campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    -- Content
    template_id         UUID REFERENCES blast_templates(id) ON DELETE SET NULL,
    subject             VARCHAR(500) NOT NULL,
    html_body           TEXT NOT NULL,
    plain_text_body     TEXT,
    -- Recipients
    segment_id          UUID REFERENCES blast_segments(id) ON DELETE SET NULL,
    recipient_count     INTEGER,
    -- Sender
    from_name           VARCHAR(100),
    from_email          VARCHAR(255),
    reply_to_email      VARCHAR(255),
    -- Scheduling
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
    scheduled_at        TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    -- Delivery stats
    total_sent          INTEGER DEFAULT 0,
    total_delivered     INTEGER DEFAULT 0,
    total_bounced       INTEGER DEFAULT 0,
    total_opened        INTEGER DEFAULT 0,
    total_clicked       INTEGER DEFAULT 0,
    total_unsubscribed  INTEGER DEFAULT 0,
    total_complained    INTEGER DEFAULT 0,
    -- Metadata
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blast_campaigns_org ON blast_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_blast_campaigns_status ON blast_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_blast_campaigns_sent ON blast_campaigns(sent_at DESC);

-- 4. blast_send_log — per-recipient delivery record
CREATE TABLE IF NOT EXISTS blast_send_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES blast_campaigns(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES bond_contacts(id) ON DELETE CASCADE,
    -- Delivery
    to_email            VARCHAR(255) NOT NULL,
    smtp_message_id     VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
    bounce_type         VARCHAR(20) CHECK (bounce_type IN ('hard', 'soft', 'complaint')),
    bounce_reason       TEXT,
    -- Tracking tokens
    tracking_token      VARCHAR(64) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    -- Timestamps
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    bounced_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blast_send_campaign ON blast_send_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_blast_send_contact ON blast_send_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_blast_send_token ON blast_send_log(tracking_token);
CREATE INDEX IF NOT EXISTS idx_blast_send_status ON blast_send_log(status);

-- 5. blast_engagement_events — opens, clicks, unsubscribes
CREATE TABLE IF NOT EXISTS blast_engagement_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_log_id         UUID NOT NULL REFERENCES blast_send_log(id) ON DELETE CASCADE,
    campaign_id         UUID NOT NULL REFERENCES blast_campaigns(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES bond_contacts(id) ON DELETE CASCADE,
    event_type          VARCHAR(20) NOT NULL
                        CHECK (event_type IN ('open', 'click', 'unsubscribe')),
    -- Click-specific
    clicked_url         TEXT,
    -- Metadata
    ip_address          INET,
    user_agent          TEXT,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blast_engage_campaign ON blast_engagement_events(campaign_id, event_type);
CREATE INDEX IF NOT EXISTS idx_blast_engage_contact ON blast_engagement_events(contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_blast_engage_send ON blast_engagement_events(send_log_id);

-- 6. blast_unsubscribes — org-level opt-out list
CREATE TABLE IF NOT EXISTS blast_unsubscribes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email               VARCHAR(255) NOT NULL,
    contact_id          UUID REFERENCES bond_contacts(id) ON DELETE SET NULL,
    reason              TEXT,
    unsubscribed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for org + email — guarded for idempotency
DO $$ BEGIN
  ALTER TABLE blast_unsubscribes ADD CONSTRAINT blast_unsubscribes_org_email_unique
    UNIQUE (organization_id, email);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_blast_unsub_org ON blast_unsubscribes(organization_id, email);

-- 7. blast_sender_domains — verified sending domains
CREATE TABLE IF NOT EXISTS blast_sender_domains (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain              VARCHAR(255) NOT NULL,
    -- Verification status
    spf_verified        BOOLEAN NOT NULL DEFAULT false,
    dkim_verified       BOOLEAN NOT NULL DEFAULT false,
    dmarc_verified      BOOLEAN NOT NULL DEFAULT false,
    verified_at         TIMESTAMPTZ,
    -- DNS records to configure
    dns_records         JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for org + domain — guarded for idempotency
DO $$ BEGIN
  ALTER TABLE blast_sender_domains ADD CONSTRAINT blast_sender_domains_org_domain_unique
    UNIQUE (organization_id, domain);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
