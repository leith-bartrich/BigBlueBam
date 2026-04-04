-- BigBlueBam – PostgreSQL initialization
-- =========================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── updated_at trigger function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- Tables
-- =========================================================================

-- ── organizations ────────────────────────────────────────────────────────
CREATE TABLE organizations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(255) NOT NULL,
    slug        varchar(255) NOT NULL UNIQUE,
    logo_url    text,
    plan        varchar(50) NOT NULL DEFAULT 'free',
    settings    jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── users ────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email               varchar(255) NOT NULL UNIQUE,
    display_name        varchar(255) NOT NULL,
    avatar_url          text,
    password_hash       text,
    role                varchar(50) NOT NULL DEFAULT 'member',
    CONSTRAINT users_role_check CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest')),
    timezone            varchar(100) NOT NULL DEFAULT 'UTC',
    notification_prefs  jsonb,
    is_active           boolean NOT NULL DEFAULT true,
    is_superuser        boolean NOT NULL DEFAULT false,
    last_seen_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── sessions ─────────────────────────────────────────────────────────────
CREATE TABLE sessions (
    id          text PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  timestamptz NOT NULL,
    data        jsonb
);

-- ── projects ─────────────────────────────────────────────────────────────
CREATE TABLE projects (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                        varchar(255) NOT NULL,
    slug                        varchar(255) NOT NULL,
    description                 text,
    icon                        varchar(50),
    color                       varchar(7),
    default_sprint_duration_days integer NOT NULL DEFAULT 14,
    task_id_prefix              varchar(10),
    task_id_sequence            integer NOT NULL DEFAULT 0,
    settings                    jsonb,
    is_archived                 boolean NOT NULL DEFAULT false,
    created_by                  uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(org_id, slug)
);

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── project_memberships ──────────────────────────────────────────────────
CREATE TABLE project_memberships (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        varchar(50) NOT NULL DEFAULT 'member',
    joined_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- ── task_states ──────────────────────────────────────────────────────────
CREATE TABLE task_states (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        varchar(100) NOT NULL,
    color       varchar(7),
    icon        varchar(50),
    category    varchar(50) NOT NULL,
    position    integer NOT NULL,
    is_default  boolean NOT NULL DEFAULT false,
    is_closed   boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── phases ───────────────────────────────────────────────────────────────
CREATE TABLE phases (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                varchar(255) NOT NULL,
    description         text,
    color               varchar(7),
    position            integer NOT NULL,
    wip_limit           integer,
    is_start            boolean NOT NULL DEFAULT false,
    is_terminal         boolean NOT NULL DEFAULT false,
    auto_state_on_enter uuid REFERENCES task_states(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(project_id, position)
);

-- ── sprints ──────────────────────────────────────────────────────────────
CREATE TABLE sprints (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        varchar(255) NOT NULL,
    goal        text,
    start_date  date,
    end_date    date,
    status      varchar(50) NOT NULL DEFAULT 'planned',
    velocity    integer,
    notes       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    closed_at   timestamptz
);

-- ── labels ───────────────────────────────────────────────────────────────
CREATE TABLE labels (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        varchar(100) NOT NULL,
    color       varchar(7),
    description text,
    position    integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── epics ────────────────────────────────────────────────────────────────
CREATE TABLE epics (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        varchar(255) NOT NULL,
    description text,
    color       varchar(7),
    start_date  date,
    target_date date,
    status      varchar(50) NOT NULL DEFAULT 'open',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── tasks ────────────────────────────────────────────────────────────────
CREATE TABLE tasks (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    human_id                varchar(50) NOT NULL,
    parent_task_id          uuid REFERENCES tasks(id) ON DELETE SET NULL,
    title                   varchar(500) NOT NULL,
    description             text,
    description_plain       text,
    phase_id                uuid REFERENCES phases(id) ON DELETE SET NULL,
    state_id                uuid REFERENCES task_states(id) ON DELETE SET NULL,
    sprint_id               uuid REFERENCES sprints(id) ON DELETE SET NULL,
    epic_id                 uuid REFERENCES epics(id) ON DELETE SET NULL,
    assignee_id             uuid REFERENCES users(id) ON DELETE SET NULL,
    reporter_id             uuid REFERENCES users(id) ON DELETE SET NULL,
    priority                varchar(20) NOT NULL DEFAULT 'medium',
    story_points            integer,
    time_estimate_minutes   integer,
    time_logged_minutes     integer NOT NULL DEFAULT 0,
    start_date              date,
    due_date                date,
    completed_at            timestamptz,
    position                double precision NOT NULL DEFAULT 0,
    labels                  uuid[] NOT NULL DEFAULT '{}',
    watchers                uuid[] NOT NULL DEFAULT '{}',
    is_blocked              boolean NOT NULL DEFAULT false,
    blocking_task_ids       uuid[] NOT NULL DEFAULT '{}',
    blocked_by_task_ids     uuid[] NOT NULL DEFAULT '{}',
    custom_fields           jsonb NOT NULL DEFAULT '{}',
    attachment_count        integer NOT NULL DEFAULT 0,
    comment_count           integer NOT NULL DEFAULT 0,
    subtask_count           integer NOT NULL DEFAULT 0,
    subtask_done_count      integer NOT NULL DEFAULT 0,
    carry_forward_count     integer NOT NULL DEFAULT 0,
    original_sprint_id      uuid REFERENCES sprints(id) ON DELETE SET NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── comments ─────────────────────────────────────────────────────────────
CREATE TABLE comments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        text NOT NULL,
    body_plain  text,
    is_system   boolean NOT NULL DEFAULT false,
    edited_at   timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── attachments ──────────────────────────────────────────────────────────
CREATE TABLE attachments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploader_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        varchar(500) NOT NULL,
    content_type    varchar(255),
    size_bytes      bigint NOT NULL,
    storage_key     text NOT NULL,
    thumbnail_key   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── activity_log ─────────────────────────────────────────────────────────
CREATE TABLE activity_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id         uuid REFERENCES tasks(id) ON DELETE SET NULL,
    actor_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    impersonator_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action          varchar(100) NOT NULL,
    details         jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── custom_field_definitions ─────────────────────────────────────────────
CREATE TABLE custom_field_definitions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                varchar(255) NOT NULL,
    field_type          varchar(50) NOT NULL,
    options             jsonb,
    is_required         boolean NOT NULL DEFAULT false,
    is_visible_on_card  boolean NOT NULL DEFAULT false,
    position            integer NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── sprint_tasks ─────────────────────────────────────────────────────────
CREATE TABLE sprint_tasks (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id               uuid NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    task_id                 uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    added_at                timestamptz NOT NULL DEFAULT now(),
    removed_at              timestamptz,
    removal_reason          varchar(100),
    story_points_at_add     integer,
    UNIQUE(sprint_id, task_id)
);

-- ── api_keys ─────────────────────────────────────────────────────────────
CREATE TABLE api_keys (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        varchar(255) NOT NULL,
    key_hash    text NOT NULL,
    key_prefix  varchar(12) NOT NULL,
    scope       varchar(50) NOT NULL DEFAULT 'read',
    project_ids uuid[],
    expires_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
);

-- ── notifications ────────────────────────────────────────────────────────
CREATE TABLE notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
    task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
    type        varchar(50) NOT NULL,
    title       varchar(500) NOT NULL,
    body        text,
    is_read     boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── time_entries ─────────────────────────────────────────────────────────
CREATE TABLE time_entries (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    minutes     integer NOT NULL,
    date        date NOT NULL,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── webhooks ────────────────────────────────────────────────────────────
CREATE TABLE webhooks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url         text NOT NULL,
    events      jsonb NOT NULL,
    secret      text NOT NULL,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── task_templates ──────────────────────────────────────────────────────
CREATE TABLE task_templates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            varchar(255) NOT NULL,
    title_pattern   varchar(500),
    description     text,
    priority        varchar(20) DEFAULT 'medium',
    phase_id        uuid REFERENCES phases(id),
    label_ids       uuid[] DEFAULT '{}',
    subtask_titles  text[] DEFAULT '{}',
    story_points    integer,
    created_by      uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_task_templates_updated_at
    BEFORE UPDATE ON task_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── comment_reactions ───────────────────────────────────────────────────
CREATE TABLE comment_reactions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id  uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       varchar(50) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(comment_id, user_id, emoji)
);

-- ── saved_views ─────────────────────────────────────────────────────────
CREATE TABLE saved_views (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        varchar(255) NOT NULL,
    filters     jsonb NOT NULL DEFAULT '{}',
    sort        varchar(100),
    view_type   varchar(20) NOT NULL DEFAULT 'board',
    swimlane    varchar(50),
    is_shared   boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_saved_views_updated_at
    BEFORE UPDATE ON saved_views
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Helpdesk Tables ─────────────────────────────────────────────────
-- HB-5 (partial): helpdesk_users is a single global customer pool with no org_id FK.
-- Known limitation: customers are not scoped to an organization, so the same email
-- cannot have distinct records per org. A future migration will add org_id (or a
-- many-to-many membership table) to support per-org customer isolation.
-- HB-44 migration note (next deploy): rename email_verification_token to
-- email_verification_token_hash and backfill with sha256(token) for any in-flight
-- verification rows. Plaintext storage is a known gap until that migration lands.
CREATE TABLE helpdesk_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(320) UNIQUE NOT NULL,
    display_name varchar(100) NOT NULL,
    password_hash text NOT NULL,
    email_verified boolean NOT NULL DEFAULT false,
    email_verification_token text,
    email_verification_sent_at timestamptz,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE helpdesk_users IS 'HB-5: Single global customer pool. No org_id column yet — customers are shared across all organizations. Tracked for future migration.';
COMMENT ON COLUMN helpdesk_users.email_verification_token IS 'HB-44: Currently plaintext. Pending migration to email_verification_token_hash (sha256). Do not expose via API.';

CREATE TRIGGER trg_helpdesk_users_updated_at
    BEFORE UPDATE ON helpdesk_users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE helpdesk_sessions (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES helpdesk_users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number serial UNIQUE,
    helpdesk_user_id uuid NOT NULL REFERENCES helpdesk_users(id) ON DELETE CASCADE,
    task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
    project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
    subject varchar(500) NOT NULL,
    description text NOT NULL,
    status varchar(50) NOT NULL DEFAULT 'open',
    priority varchar(20) NOT NULL DEFAULT 'medium',
    category varchar(100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    closed_at timestamptz
);

CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE ticket_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_type varchar(20) NOT NULL,
    author_id uuid NOT NULL,
    author_name varchar(100) NOT NULL,
    body text NOT NULL,
    is_internal boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE helpdesk_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    require_email_verification boolean NOT NULL DEFAULT false,
    allowed_email_domains text[] NOT NULL DEFAULT '{}',
    default_project_id uuid REFERENCES projects(id),
    default_phase_id uuid REFERENCES phases(id),
    default_priority varchar(20) NOT NULL DEFAULT 'medium',
    categories jsonb NOT NULL DEFAULT '[]',
    welcome_message text,
    auto_close_days integer NOT NULL DEFAULT 0,
    notify_on_status_change boolean NOT NULL DEFAULT true,
    notify_on_agent_reply boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_helpdesk_settings_updated_at
    BEFORE UPDATE ON helpdesk_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_tickets_helpdesk_user ON tickets (helpdesk_user_id);
CREATE INDEX idx_tickets_task_id ON tickets (task_id);
CREATE INDEX idx_tickets_status ON tickets (status);
CREATE INDEX idx_ticket_messages_ticket ON ticket_messages (ticket_id, created_at);
CREATE INDEX idx_helpdesk_sessions_user ON helpdesk_sessions (user_id);

-- =========================================================================
-- Indexes
-- =========================================================================

-- tasks
CREATE INDEX idx_tasks_board
    ON tasks (project_id, sprint_id, phase_id, position);
CREATE UNIQUE INDEX idx_tasks_human_id
    ON tasks (project_id, human_id);
CREATE INDEX idx_tasks_assignee_state
    ON tasks (assignee_id, state_id);
CREATE INDEX idx_tasks_due_date
    ON tasks (project_id, due_date);
CREATE INDEX idx_tasks_labels
    ON tasks USING GIN (labels);
CREATE INDEX idx_tasks_fulltext
    ON tasks USING GIN (to_tsvector('english', coalesce(description_plain, '')));

-- activity_log
CREATE INDEX idx_activity_project_time
    ON activity_log (project_id, created_at);
CREATE INDEX idx_activity_task_time
    ON activity_log (task_id, created_at);

-- notifications
CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id, is_read, created_at);

-- time_entries
CREATE INDEX idx_time_entries_task_id
    ON time_entries (task_id);
CREATE INDEX idx_time_entries_user_id
    ON time_entries (user_id);
CREATE INDEX idx_time_entries_user_date
    ON time_entries (user_id, date);

-- webhooks
CREATE INDEX idx_webhooks_project_id
    ON webhooks (project_id);

-- task_templates
CREATE INDEX idx_task_templates_project_id
    ON task_templates (project_id);

-- comment_reactions
CREATE INDEX idx_comment_reactions_comment_id
    ON comment_reactions (comment_id);

-- saved_views
CREATE INDEX idx_saved_views_project_id
    ON saved_views (project_id);
CREATE INDEX idx_saved_views_user_id
    ON saved_views (user_id);

-- =========================================================================
-- Banter Tables
-- =========================================================================

-- ── banter_channel_groups ───────────────────────────────────────────────
CREATE TABLE banter_channel_groups (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                  varchar(100) NOT NULL,
    position              int NOT NULL DEFAULT 0,
    is_collapsed_default  boolean NOT NULL DEFAULT false,
    created_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE(org_id, name)
);

-- ── banter_channels ─────────────────────────────────────────────────────
CREATE TABLE banter_channels (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                    varchar(80) NOT NULL,
    display_name            varchar(100),
    slug                    varchar(80) NOT NULL,
    type                    varchar(20) NOT NULL DEFAULT 'public',
    topic                   varchar(500),
    description             text,
    icon                    varchar(10),
    channel_group_id        uuid REFERENCES banter_channel_groups(id) ON DELETE SET NULL,
    created_by              uuid NOT NULL REFERENCES users(id),
    is_archived             boolean NOT NULL DEFAULT false,
    is_default              boolean NOT NULL DEFAULT false,
    allow_bots              boolean NOT NULL DEFAULT true,
    allow_huddles           boolean NOT NULL DEFAULT true,
    message_retention_days  int,
    last_message_at         timestamptz,
    last_message_preview    varchar(200),
    message_count           int NOT NULL DEFAULT 0,
    member_count            int NOT NULL DEFAULT 0,
    active_huddle_id        uuid,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE(org_id, slug)
);

CREATE TRIGGER trg_banter_channels_updated_at
    BEFORE UPDATE ON banter_channels
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── banter_messages ─────────────────────────────────────────────────────
CREATE TABLE banter_messages (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id        uuid NOT NULL REFERENCES banter_channels(id) ON DELETE CASCADE,
    author_id         uuid NOT NULL REFERENCES users(id),
    thread_parent_id  uuid REFERENCES banter_messages(id) ON DELETE SET NULL,
    content           text NOT NULL,
    content_plain     text NOT NULL DEFAULT '',
    content_format    varchar(20) NOT NULL DEFAULT 'html',
    is_system         boolean NOT NULL DEFAULT false,
    is_bot            boolean NOT NULL DEFAULT false,
    is_edited         boolean NOT NULL DEFAULT false,
    is_deleted        boolean NOT NULL DEFAULT false,
    edited_at         timestamptz,
    deleted_at        timestamptz,
    deleted_by        uuid REFERENCES users(id),
    call_id           uuid,
    reply_count       int NOT NULL DEFAULT 0,
    reply_user_ids    uuid[] NOT NULL DEFAULT '{}',
    last_reply_at     timestamptz,
    reaction_counts   jsonb NOT NULL DEFAULT '{}',
    attachment_count  int NOT NULL DEFAULT 0,
    has_link_preview  boolean NOT NULL DEFAULT false,
    metadata          jsonb NOT NULL DEFAULT '{}',
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── banter_channel_memberships ──────────────────────────────────────────
CREATE TABLE banter_channel_memberships (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id            uuid NOT NULL REFERENCES banter_channels(id) ON DELETE CASCADE,
    user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                  varchar(20) NOT NULL DEFAULT 'member',
    notifications         varchar(20) NOT NULL DEFAULT 'default',
    is_muted              boolean NOT NULL DEFAULT false,
    joined_at             timestamptz NOT NULL DEFAULT now(),
    last_read_message_id  uuid REFERENCES banter_messages(id) ON DELETE SET NULL,
    last_read_at          timestamptz,
    UNIQUE(channel_id, user_id),
    CONSTRAINT banter_channel_memberships_role_check CHECK (role IN ('owner', 'admin', 'member'))
);

-- ── banter_message_attachments ──────────────────────────────────────────
CREATE TABLE banter_message_attachments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id        uuid NOT NULL REFERENCES banter_messages(id) ON DELETE CASCADE,
    uploader_id       uuid NOT NULL REFERENCES users(id),
    filename          varchar(255) NOT NULL,
    content_type      varchar(100) NOT NULL,
    size_bytes        bigint NOT NULL,
    storage_key       text NOT NULL,
    thumbnail_key     text,
    width             int,
    height            int,
    duration_seconds  int,
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── banter_message_reactions ────────────────────────────────────────────
CREATE TABLE banter_message_reactions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  uuid NOT NULL REFERENCES banter_messages(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       varchar(50) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
);

-- ── banter_pins ─────────────────────────────────────────────────────────
CREATE TABLE banter_pins (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id  uuid NOT NULL REFERENCES banter_channels(id) ON DELETE CASCADE,
    message_id  uuid NOT NULL REFERENCES banter_messages(id) ON DELETE CASCADE,
    pinned_by   uuid NOT NULL REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(channel_id, message_id)
);

-- ── banter_bookmarks ────────────────────────────────────────────────────
CREATE TABLE banter_bookmarks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id  uuid NOT NULL REFERENCES banter_messages(id) ON DELETE CASCADE,
    note        varchar(500),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, message_id)
);

-- ── banter_calls ────────────────────────────────────────────────────────
CREATE TABLE banter_calls (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id               uuid NOT NULL REFERENCES banter_channels(id) ON DELETE CASCADE,
    started_by               uuid NOT NULL REFERENCES users(id),
    type                     varchar(20) NOT NULL,
    status                   varchar(20) NOT NULL DEFAULT 'ringing',
    livekit_room_name        varchar(255) NOT NULL,
    livekit_room_sid         varchar(255),
    title                    varchar(255),
    recording_enabled        boolean NOT NULL DEFAULT false,
    recording_storage_key    text,
    transcription_enabled    boolean NOT NULL DEFAULT false,
    transcript_storage_key   text,
    ai_agent_mode            varchar(20) NOT NULL DEFAULT 'auto',
    peak_participant_count   int NOT NULL DEFAULT 0,
    started_at               timestamptz NOT NULL DEFAULT now(),
    ended_at                 timestamptz,
    duration_seconds         int
);

-- One active huddle per channel
CREATE UNIQUE INDEX idx_banter_calls_active_huddle
    ON banter_calls (channel_id) WHERE type = 'huddle' AND status = 'active';

-- Add FK for active_huddle_id now that banter_calls exists
ALTER TABLE banter_channels
    ADD CONSTRAINT fk_banter_channels_active_huddle
    FOREIGN KEY (active_huddle_id) REFERENCES banter_calls(id) ON DELETE SET NULL;

-- Add FK for banter_messages.call_id
ALTER TABLE banter_messages
    ADD CONSTRAINT fk_banter_messages_call_id
    FOREIGN KEY (call_id) REFERENCES banter_calls(id) ON DELETE SET NULL;

-- ── banter_call_participants ────────────────────────────────────────────
CREATE TABLE banter_call_participants (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id             uuid NOT NULL REFERENCES banter_calls(id) ON DELETE CASCADE,
    user_id             uuid NOT NULL REFERENCES users(id),
    role                varchar(20) NOT NULL DEFAULT 'participant',
    joined_at           timestamptz NOT NULL DEFAULT now(),
    left_at             timestamptz,
    duration_seconds    int,
    has_audio           boolean NOT NULL DEFAULT true,
    has_video           boolean NOT NULL DEFAULT false,
    has_screen_share    boolean NOT NULL DEFAULT false,
    is_bot              boolean NOT NULL DEFAULT false,
    participation_mode  varchar(20) NOT NULL DEFAULT 'media',
    UNIQUE(call_id, user_id, joined_at)
);

-- ── banter_call_transcripts ─────────────────────────────────────────────
CREATE TABLE banter_call_transcripts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id     uuid NOT NULL REFERENCES banter_calls(id) ON DELETE CASCADE,
    speaker_id  uuid NOT NULL REFERENCES users(id),
    content     text NOT NULL,
    started_at  timestamptz NOT NULL,
    ended_at    timestamptz NOT NULL,
    confidence  float,
    is_final    boolean NOT NULL DEFAULT true
);

-- ── banter_user_groups ──────────────────────────────────────────────────
CREATE TABLE banter_user_groups (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        varchar(80) NOT NULL,
    handle      varchar(80) NOT NULL,
    description varchar(500),
    created_by  uuid NOT NULL REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(org_id, handle)
);

CREATE TRIGGER trg_banter_user_groups_updated_at
    BEFORE UPDATE ON banter_user_groups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── banter_user_group_memberships ───────────────────────────────────────
CREATE TABLE banter_user_group_memberships (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id  uuid NOT NULL REFERENCES banter_user_groups(id) ON DELETE CASCADE,
    user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(group_id, user_id)
);

-- ── banter_user_preferences ─────────────────────────────────────────────
CREATE TABLE banter_user_preferences (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    default_notification_level  varchar(20) NOT NULL DEFAULT 'mentions',
    sidebar_sort                varchar(20) NOT NULL DEFAULT 'recent',
    sidebar_collapsed_groups    uuid[] NOT NULL DEFAULT '{}',
    theme_override              varchar(20),
    enter_sends_message         boolean NOT NULL DEFAULT true,
    show_message_timestamps     varchar(20) NOT NULL DEFAULT 'hover',
    compact_mode                boolean NOT NULL DEFAULT false,
    auto_join_huddles           boolean NOT NULL DEFAULT false,
    noise_suppression           boolean NOT NULL DEFAULT true,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_banter_user_preferences_updated_at
    BEFORE UPDATE ON banter_user_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── banter_settings ─────────────────────────────────────────────────────
CREATE TABLE banter_settings (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      uuid NOT NULL REFERENCES organizations(id) UNIQUE,
    default_channel_id          uuid REFERENCES banter_channels(id) ON DELETE SET NULL,
    allow_channel_creation      varchar(20) NOT NULL DEFAULT 'members',
    allow_dm                    boolean NOT NULL DEFAULT true,
    allow_group_dm              boolean NOT NULL DEFAULT true,
    allow_guest_access          boolean NOT NULL DEFAULT false,
    message_retention_days      int NOT NULL DEFAULT 0,
    max_file_size_mb            int NOT NULL DEFAULT 25,
    allowed_file_types          text[] NOT NULL DEFAULT '{}',
    custom_emoji                jsonb NOT NULL DEFAULT '[]',
    enable_link_previews        boolean NOT NULL DEFAULT true,
    enable_bbb_integration      boolean NOT NULL DEFAULT true,
    voice_video_enabled         boolean NOT NULL DEFAULT false,
    livekit_host                varchar(500),
    livekit_api_key             varchar(255),
    livekit_api_secret          text,
    max_call_participants       int NOT NULL DEFAULT 50,
    max_call_duration_minutes   int NOT NULL DEFAULT 480,
    allow_recording             boolean NOT NULL DEFAULT false,
    recording_storage_prefix    varchar(255) NOT NULL DEFAULT 'banter/recordings/',
    transcription_enabled       boolean NOT NULL DEFAULT false,
    stt_provider                varchar(50),
    stt_provider_config         jsonb NOT NULL DEFAULT '{}',
    tts_provider                varchar(50),
    tts_provider_config         jsonb NOT NULL DEFAULT '{}',
    tts_default_voice           varchar(100),
    ai_voice_agent_enabled      boolean NOT NULL DEFAULT false,
    ai_voice_agent_llm_provider varchar(50) NOT NULL DEFAULT 'anthropic',
    ai_voice_agent_llm_config   jsonb NOT NULL DEFAULT '{}',
    ai_voice_agent_greeting     varchar(500),
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_banter_settings_updated_at
    BEFORE UPDATE ON banter_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- Banter Indexes
-- =========================================================================

-- banter_channels
CREATE INDEX idx_banter_channels_org_type
    ON banter_channels (org_id, type, is_archived);
CREATE INDEX idx_banter_channels_org_last_message
    ON banter_channels (org_id, last_message_at DESC);

-- banter_channel_memberships
CREATE INDEX idx_banter_channel_memberships_user
    ON banter_channel_memberships (user_id);
CREATE INDEX idx_banter_channel_memberships_channel
    ON banter_channel_memberships (channel_id);

-- banter_messages
CREATE INDEX idx_banter_messages_channel_created
    ON banter_messages (channel_id, created_at);
CREATE INDEX idx_banter_messages_channel_thread
    ON banter_messages (channel_id, thread_parent_id, created_at);
CREATE INDEX idx_banter_messages_author
    ON banter_messages (author_id, created_at);
CREATE INDEX idx_banter_messages_channel_id
    ON banter_messages (channel_id, id);

-- banter_message_attachments
CREATE INDEX idx_banter_message_attachments_message
    ON banter_message_attachments (message_id);

-- banter_message_reactions
CREATE INDEX idx_banter_message_reactions_message
    ON banter_message_reactions (message_id);

-- banter_pins
CREATE INDEX idx_banter_pins_channel
    ON banter_pins (channel_id);

-- banter_bookmarks
CREATE INDEX idx_banter_bookmarks_user
    ON banter_bookmarks (user_id);

-- banter_calls
CREATE INDEX idx_banter_calls_channel_status
    ON banter_calls (channel_id, status);
CREATE INDEX idx_banter_calls_channel_started
    ON banter_calls (channel_id, started_at DESC);
CREATE INDEX idx_banter_calls_started_by
    ON banter_calls (started_by, started_at DESC);

-- banter_call_participants
CREATE INDEX idx_banter_call_participants_call
    ON banter_call_participants (call_id, left_at NULLS FIRST);

-- banter_call_transcripts
CREATE INDEX idx_banter_call_transcripts_call
    ON banter_call_transcripts (call_id, started_at);

-- banter_user_groups
CREATE INDEX idx_banter_user_groups_org
    ON banter_user_groups (org_id);

-- banter_user_group_memberships
CREATE INDEX idx_banter_user_group_memberships_group
    ON banter_user_group_memberships (group_id);
CREATE INDEX idx_banter_user_group_memberships_user
    ON banter_user_group_memberships (user_id);

-- ── SuperUser Audit Log ─────────────────────────────────────────────
CREATE TABLE superuser_audit_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    superuser_id    uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action          varchar(100) NOT NULL,
    target_org_id   uuid,
    target_user_id  uuid,
    details         jsonb NOT NULL DEFAULT '{}',
    ip_address      varchar(45),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_su_audit_superuser ON superuser_audit_log (superuser_id);
CREATE INDEX idx_su_audit_action ON superuser_audit_log (action);
CREATE INDEX idx_su_audit_created_at ON superuser_audit_log (created_at DESC);

-- ── Impersonation Sessions ──────────────────────────────────────────
CREATE TABLE impersonation_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    superuser_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL,
    ended_at        timestamptz
);

CREATE INDEX idx_imp_sessions_superuser ON impersonation_sessions (superuser_id);
CREATE INDEX idx_imp_sessions_target ON impersonation_sessions (target_user_id);
CREATE INDEX idx_imp_sessions_active ON impersonation_sessions (superuser_id, target_user_id, ended_at);

-- ── Guest Invitations ──────────────────────────────────────────────
CREATE TABLE guest_invitations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by      uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    email           varchar(320) NOT NULL,
    role            varchar(20) NOT NULL DEFAULT 'guest',
    project_ids     text[],
    channel_ids     text[],
    token           varchar(100) NOT NULL UNIQUE,
    accepted_at     timestamptz,
    expires_at      timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_invitations_org ON guest_invitations (org_id);
CREATE INDEX idx_guest_invitations_email ON guest_invitations (email);
CREATE INDEX idx_guest_invitations_token ON guest_invitations (token);

-- ── Organization Memberships (multi-org support) ─────────────────────
-- Supports many-to-many relationship between users and organizations.
-- Migration path: users.org_id and users.role remain for backward
-- compatibility. The migrate-org-memberships.js script backfills this
-- table from the existing users.org_id/role columns. Once all code reads
-- from organization_memberships, the users.org_id column can be dropped.
CREATE TABLE organization_memberships (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role        varchar(20) NOT NULL DEFAULT 'member',
    is_default  boolean NOT NULL DEFAULT false,
    joined_at   timestamptz NOT NULL DEFAULT now(),
    invited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, org_id),
    CONSTRAINT org_memberships_role_check CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest'))
);

CREATE INDEX idx_org_memberships_user_id ON organization_memberships (user_id);
CREATE INDEX idx_org_memberships_org_id ON organization_memberships (org_id);
CREATE INDEX org_memberships_user_default_idx ON organization_memberships (user_id, is_default);
-- Enforce at most one default membership per user.
CREATE UNIQUE INDEX org_memberships_user_default_unique
    ON organization_memberships (user_id)
    WHERE is_default = true;
