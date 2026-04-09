-- 0036_book_tables.sql
-- Why: Create schema for Book (Scheduling & Calendar) — calendars, events, attendees,
--       working hours, booking pages, external connections, and external event mirrors.
-- Client impact: additive only

-- ============================================================
-- BOOK: Scheduling & Calendar
-- ============================================================

-- 1. Calendars
CREATE TABLE IF NOT EXISTS book_calendars (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    owner_user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    color               VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
    calendar_type       VARCHAR(20) NOT NULL DEFAULT 'personal'
                        CHECK (calendar_type IN ('personal', 'team', 'project', 'booking')),
    is_default          BOOLEAN NOT NULL DEFAULT false,
    timezone            VARCHAR(50) NOT NULL DEFAULT 'UTC',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_cal_org ON book_calendars(organization_id);
CREATE INDEX IF NOT EXISTS idx_book_cal_owner ON book_calendars(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_book_cal_project ON book_calendars(project_id);

-- 2. Booking pages (must come before events due to FK reference)
CREATE TABLE IF NOT EXISTS book_booking_pages (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    owner_user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug                     VARCHAR(60) NOT NULL,
    title                    VARCHAR(255) NOT NULL,
    description              TEXT,
    duration_minutes         INTEGER NOT NULL DEFAULT 30,
    buffer_before_min        INTEGER NOT NULL DEFAULT 0,
    buffer_after_min         INTEGER NOT NULL DEFAULT 15,
    max_advance_days         INTEGER NOT NULL DEFAULT 60,
    min_notice_hours         INTEGER NOT NULL DEFAULT 4,
    color                    VARCHAR(7) DEFAULT '#3b82f6',
    logo_url                 TEXT,
    confirmation_message     TEXT DEFAULT 'Your meeting has been booked! You will receive a confirmation email.',
    redirect_url             TEXT,
    auto_create_bond_contact BOOLEAN NOT NULL DEFAULT true,
    auto_create_bam_task     BOOLEAN NOT NULL DEFAULT false,
    bam_project_id           UUID REFERENCES projects(id),
    enabled                  BOOLEAN NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE book_booking_pages ADD CONSTRAINT book_booking_pages_org_slug_unique UNIQUE (organization_id, slug);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_book_pages_org ON book_booking_pages(organization_id);
CREATE INDEX IF NOT EXISTS idx_book_pages_owner ON book_booking_pages(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_book_pages_slug ON book_booking_pages(slug) WHERE enabled = true;

-- 3. Events
CREATE TABLE IF NOT EXISTS book_events (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id          UUID NOT NULL REFERENCES book_calendars(id) ON DELETE CASCADE,
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title                VARCHAR(500) NOT NULL,
    description          TEXT,
    location             TEXT,
    meeting_url          TEXT,
    start_at             TIMESTAMPTZ NOT NULL,
    end_at               TIMESTAMPTZ NOT NULL,
    all_day              BOOLEAN NOT NULL DEFAULT false,
    timezone             VARCHAR(50) NOT NULL DEFAULT 'UTC',
    recurrence_rule      VARCHAR(30) CHECK (recurrence_rule IN ('daily', 'weekly', 'biweekly', 'monthly')),
    recurrence_end_at    TIMESTAMPTZ,
    recurrence_parent_id UUID REFERENCES book_events(id) ON DELETE CASCADE,
    status               VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                         CHECK (status IN ('tentative', 'confirmed', 'cancelled')),
    visibility           VARCHAR(20) NOT NULL DEFAULT 'busy'
                         CHECK (visibility IN ('free', 'busy', 'tentative', 'out_of_office')),
    linked_entity_type   VARCHAR(20) CHECK (linked_entity_type IN ('bam_task', 'bond_deal', 'helpdesk_ticket')),
    linked_entity_id     UUID,
    booking_page_id      UUID REFERENCES book_booking_pages(id) ON DELETE SET NULL,
    booked_by_name       VARCHAR(200),
    booked_by_email      VARCHAR(255),
    created_by           UUID NOT NULL REFERENCES users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_event_times CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_book_events_calendar ON book_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_book_events_org ON book_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_book_events_time ON book_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_book_events_recurrence ON book_events(recurrence_parent_id);

-- 4. Event attendees
CREATE TABLE IF NOT EXISTS book_event_attendees (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id         UUID NOT NULL REFERENCES book_events(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
    email            VARCHAR(255) NOT NULL,
    name             VARCHAR(200),
    response_status  VARCHAR(20) NOT NULL DEFAULT 'needs_action'
                     CHECK (response_status IN ('needs_action', 'accepted', 'declined', 'tentative')),
    is_organizer     BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_attendees_event ON book_event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_book_attendees_user ON book_event_attendees(user_id);

-- 5. Working hours
CREATE TABLE IF NOT EXISTS book_working_hours (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    timezone     VARCHAR(50) NOT NULL DEFAULT 'UTC',
    enabled      BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT valid_work_times CHECK (end_time > start_time)
);

DO $$ BEGIN
  ALTER TABLE book_working_hours ADD CONSTRAINT book_working_hours_user_day_unique UNIQUE (user_id, day_of_week);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. External calendar connections
CREATE TABLE IF NOT EXISTS book_external_connections (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider              VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'microsoft')),
    access_token          TEXT NOT NULL,
    refresh_token         TEXT,
    token_expires_at      TIMESTAMPTZ,
    external_calendar_id  VARCHAR(255) NOT NULL,
    sync_direction        VARCHAR(10) NOT NULL DEFAULT 'both'
                          CHECK (sync_direction IN ('inbound', 'outbound', 'both')),
    last_sync_at          TIMESTAMPTZ,
    sync_status           VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (sync_status IN ('active', 'paused', 'error')),
    sync_error            TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_ext_user ON book_external_connections(user_id);

-- 7. External events mirror
CREATE TABLE IF NOT EXISTS book_external_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id     UUID NOT NULL REFERENCES book_external_connections(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_event_id VARCHAR(255) NOT NULL,
    title             VARCHAR(500),
    start_at          TIMESTAMPTZ NOT NULL,
    end_at            TIMESTAMPTZ NOT NULL,
    all_day           BOOLEAN NOT NULL DEFAULT false,
    visibility        VARCHAR(20) NOT NULL DEFAULT 'busy',
    synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE book_external_events ADD CONSTRAINT book_ext_events_conn_ext_unique UNIQUE (connection_id, external_event_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_book_ext_events_user ON book_external_events(user_id, start_at, end_at);

-- 8. iCal feed tokens (for authenticated iCal subscriptions)
CREATE TABLE IF NOT EXISTS book_ical_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id  UUID NOT NULL REFERENCES book_calendars(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token        VARCHAR(64) NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_ical_tokens_token ON book_ical_tokens(token);
