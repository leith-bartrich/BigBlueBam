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
    timezone            varchar(100) NOT NULL DEFAULT 'UTC',
    notification_prefs  jsonb,
    is_active           boolean NOT NULL DEFAULT true,
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
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
    actor_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action      varchar(100) NOT NULL,
    details     jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
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
    project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
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
    helpdesk_user_id uuid NOT NULL REFERENCES helpdesk_users(id),
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
