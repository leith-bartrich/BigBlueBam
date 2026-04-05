-- ─────────────────────────────────────────────────────────────────────────
-- 0020_github_integrations.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Client impact: additive only. Two new tables
--      (github_integrations, task_github_refs). No existing columns,
--      constraints, or indexes touched. Nothing in the app queries these
--      tables until the new /webhooks/github + github-integration routes
--      ship alongside this migration.
-- Why: Phase 6 GitHub integration. Teams want commits and PRs that mention
--      a task (e.g. "MAGE-38: fix the thing") to auto-link back to the task
--      in BBB, and optionally auto-transition the task through phases as
--      its PR opens/merges on GitHub.
--
--      The integration is per-project. Each project can bind exactly one
--      GitHub repo (repo_owner/repo_name), with its own HMAC webhook
--      secret, and opt into two transitions:
--        - transition_on_pr_open_phase_id    → typically "In Review"
--        - transition_on_pr_merged_phase_id  → typically "Done"
--
--      task_github_refs stores one row per (task, ref_type, ref_id) link:
--      commits are keyed by SHA, pull requests by PR number. The unique
--      constraint makes the ingest idempotent — replays of the same push
--      or PR event insert nothing new. PR rows carry a status column so
--      we can flip open→merged without creating a duplicate link. Rows
--      are CASCADE-deleted with their task, but the integration row is
--      DELETE SET NULL on phases (removing a phase must not nuke the
--      integration) and SET NULL on created_by (user deletion is
--      non-fatal).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS github_integrations (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                        uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  repo_owner                        varchar(100) NOT NULL,
  repo_name                         varchar(200) NOT NULL,
  webhook_secret                    text NOT NULL,
  transition_on_pr_open_phase_id    uuid REFERENCES phases(id) ON DELETE SET NULL,
  transition_on_pr_merged_phase_id  uuid REFERENCES phases(id) ON DELETE SET NULL,
  enabled                           boolean NOT NULL DEFAULT true,
  created_by                        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT github_integrations_repo_unique UNIQUE (repo_owner, repo_name)
);

CREATE INDEX IF NOT EXISTS idx_github_integrations_repo
  ON github_integrations (repo_owner, repo_name);

CREATE TABLE IF NOT EXISTS task_github_refs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  ref_type     varchar(20) NOT NULL,
  ref_id       varchar(100) NOT NULL,
  ref_url      text NOT NULL,
  ref_title    text,
  author_name  varchar(200),
  status       varchar(50),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_github_refs_ref_type_check
    CHECK (ref_type IN ('commit', 'pull_request')),
  CONSTRAINT task_github_refs_unique UNIQUE (task_id, ref_type, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_task_github_refs_task
  ON task_github_refs (task_id, created_at DESC);
