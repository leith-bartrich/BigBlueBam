-- 0031_board_tables.sql
-- Why: Create tables for the Board visual collaboration/whiteboard feature —
--   templates, boards, elements, versions, task links, collaborators, stars,
--   and side-chat messages.
-- Client impact: additive only

-- ---------------------------------------------------------------------------
-- board_templates (must be created first — boards references it)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS board_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  category      VARCHAR(100),
  icon          VARCHAR(10),
  yjs_state     BYTEA,
  thumbnail_url VARCHAR(2048),
  sort_order    INT NOT NULL DEFAULT 0,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- boards
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS boards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  icon              VARCHAR(10),
  yjs_state         BYTEA,
  thumbnail_url     VARCHAR(2048),
  template_id       UUID REFERENCES board_templates(id) ON DELETE SET NULL,
  background        VARCHAR(20) NOT NULL DEFAULT 'dots'
                    CHECK (background IN ('dots','grid','lines','plain')),
  locked            BOOLEAN NOT NULL DEFAULT FALSE,
  visibility        VARCHAR(20) NOT NULL DEFAULT 'project'
                    CHECK (visibility IN ('private','project','organization')),
  default_viewport  JSONB,
  created_by        UUID NOT NULL REFERENCES users(id),
  updated_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_boards_organization_id
  ON boards(organization_id);

CREATE INDEX IF NOT EXISTS idx_boards_project_id
  ON boards(project_id);

CREATE INDEX IF NOT EXISTS idx_boards_created_by
  ON boards(created_by);

-- ---------------------------------------------------------------------------
-- board_elements (denormalized snapshot of tldraw shapes)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS board_elements (
  id            UUID PRIMARY KEY,
  board_id      UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  element_type  VARCHAR(30),
  text_content  TEXT,
  x             DOUBLE PRECISION NOT NULL DEFAULT 0,
  y             DOUBLE PRECISION NOT NULL DEFAULT 0,
  width         DOUBLE PRECISION,
  height        DOUBLE PRECISION,
  rotation      DOUBLE PRECISION NOT NULL DEFAULT 0,
  color         VARCHAR(20),
  font_size     VARCHAR(10),
  frame_id      UUID,
  group_id      UUID,
  arrow_start   JSONB,
  arrow_end     JSONB,
  arrow_label   TEXT,
  embed_type    VARCHAR(20),
  embed_ref_id  UUID,
  embed_url     VARCHAR(2048),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_elements_board_id
  ON board_elements(board_id);

CREATE INDEX IF NOT EXISTS idx_board_elements_element_type
  ON board_elements(element_type);

CREATE INDEX IF NOT EXISTS idx_board_elements_frame_id
  ON board_elements(frame_id);

CREATE INDEX IF NOT EXISTS idx_board_elements_text_content_fts
  ON board_elements USING gin(to_tsvector('english', coalesce(text_content, '')));

-- ---------------------------------------------------------------------------
-- board_versions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS board_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  version_number  INT NOT NULL,
  name            VARCHAR(255),
  yjs_state       BYTEA,
  thumbnail_url   VARCHAR(2048),
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE board_versions
    ADD CONSTRAINT uq_board_versions_board_version UNIQUE (board_id, version_number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- board_task_links
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS board_task_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  element_id  UUID,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE board_task_links
    ADD CONSTRAINT uq_board_task_links_element_task UNIQUE (element_id, task_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_board_task_links_board_id
  ON board_task_links(board_id);

CREATE INDEX IF NOT EXISTS idx_board_task_links_task_id
  ON board_task_links(task_id);

-- ---------------------------------------------------------------------------
-- board_collaborators
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS board_collaborators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission  VARCHAR(20) NOT NULL DEFAULT 'edit'
              CHECK (permission IN ('view','edit')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE board_collaborators
    ADD CONSTRAINT uq_board_collaborators_board_user UNIQUE (board_id, user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- board_stars
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS board_stars (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE board_stars
    ADD CONSTRAINT uq_board_stars_board_user UNIQUE (board_id, user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- board_chat_messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS board_chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_chat_messages_board_created
  ON board_chat_messages(board_id, created_at DESC);
