-- ─────────────────────────────────────────────────────────────────────────
-- 0021_slack_integrations.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Client impact: additive only (one new table).
-- Why: Phase 6 Slack integration. Small/medium teams want lightweight
--      outbound notifications to Slack channels when tasks are created or
--      completed and when sprints start/finish, plus a minimal `/bbb`
--      slash command to look up a task from inside Slack.
--
--      Full Slack OAuth + bot install is a multi-day effort. Instead we
--      store one Slack **incoming webhook URL** per project (manually
--      pasted by an admin from Slack's "Incoming Webhooks" app) and fire
--      outbound messages against it. For the slash command we verify the
--      optional `slash_command_token` against Slack's legacy verification
--      token. This pattern is enough for the "paste a URL, get pinged on
--      channel X" use case many teams actually want. OAuth can be layered
--      on later without breaking this schema.
--
-- Scope: one row per project. The UNIQUE(project_id) constraint keeps
--        things simple — each project has at most one Slack channel it
--        pipes to. Teams that need multi-channel fanout can upgrade later.
--        `slash_command_token` is nullable because teams may only want
--        outbound notifications and never set up the slash command.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS slack_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  webhook_url text NOT NULL,
  notify_on_task_created boolean NOT NULL DEFAULT true,
  notify_on_task_completed boolean NOT NULL DEFAULT true,
  notify_on_sprint_started boolean NOT NULL DEFAULT true,
  notify_on_sprint_completed boolean NOT NULL DEFAULT true,
  slash_command_token text,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slack_integrations_project_id_idx
  ON slack_integrations(project_id);
