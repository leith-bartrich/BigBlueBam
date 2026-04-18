-- 0129_activity_unified_view.sql
-- Why: Wave 3 of AGENTIC_TODO §5. Creates a normalized UNION ALL view over Bam activity_log,
--   bond_activities, and ticket_activity_log so agent-facing tools can query an entity's
--   history or an actor's activity across all three sources with one query plan and one cursor.
-- Client impact: additive only. View is read-only; no table is touched.
--
-- ======================================================================
-- LANDMINE: actor_type remap (DO NOT CONFUSE)
-- ======================================================================
-- The three source tables use DIFFERENT vocabularies for "actor_type" and
-- it is very easy to get this wrong. Stop and read before editing this
-- mapping.
--
--   * Bam activity_log (column `actor_type`, enum actor_type) speaks the
--     Wave 1 platform vocabulary from migration 0127:
--        'human'   — a real person
--        'agent'   — an AI agent (autonomous LLM-driven service account)
--        'service' — a system/service account that is not an AI agent
--
--   * Bond bond_activities has NO actor_type column at all. We infer
--     actor_type by joining users.kind from the performed_by FK when it is
--     set, and fall back to 'service' when performed_by is NULL (system-
--     written activity).
--
--   * Helpdesk ticket_activity_log (column `actor_type`, varchar check
--     constraint) speaks the helpdesk vocabulary from migration 0010:
--        'customer' — the end-user who opened the ticket (helpdesk_users)
--        'agent'    — a HUMAN SUPPORT AGENT (a Bam user, NOT an AI agent)
--        'system'   — a non-human automated action
--
--     The word "agent" here means "support agent / human staff". It was
--     baked in before the platform had an AI-agent concept. REMAPPING
--     HELPDESK 'agent' -> platform 'agent' WOULD BE WRONG and would tag
--     every human support reply as AI activity.
--
-- Remap rules in this view (applied in the ticket_activity_log SELECT):
--
--     helpdesk value  -> unified value
--     'customer'      -> 'human'       (end-users ARE humans)
--     'agent'         -> 'human'       (human support agents ARE humans,
--                                       NOT AI agents — this is the trap)
--     'system'        -> 'service'     (matches platform vocabulary)
--
-- If a future migration adds a "real" AI-agent concept on the helpdesk
-- side it must use a different label (e.g. 'ai_agent') and be remapped
-- to platform 'agent' here. Do not reuse 'agent' for AI on the helpdesk
-- side without also fixing this view.
-- ======================================================================

-- ──────────────────────────────────────────────────────────────────────
-- Supporting indexes
-- ──────────────────────────────────────────────────────────────────────
-- activity_log already has idx_activity_actor_type_time from 0127.
-- These two add actor-first indexes on the two peer-app tables so the
-- by-actor query shape does not do a full scan.

CREATE INDEX IF NOT EXISTS idx_bond_activities_performed_by_time
    ON bond_activities (performed_by, performed_at DESC)
    WHERE performed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_activity_log_actor_time
    ON ticket_activity_log (actor_id, created_at DESC)
    WHERE actor_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- v_activity_unified
-- ──────────────────────────────────────────────────────────────────────
-- Plain view (NOT materialized): agents need freshness for "who just
-- touched this" queries. Keeping it on-demand also sidesteps the refresh
-- lock that materialized views take.
--
-- Normalized columns (every SELECT must project this shape):
--   id               uuid         — source row id (NOT globally unique across
--                                    source_app; pair with source_app for
--                                    uniqueness).
--   source_app       text         — one of 'bam', 'bond', 'helpdesk'.
--   entity_type      text         — e.g. 'bam.task', 'bond.deal',
--                                    'bond.contact', 'bond.company',
--                                    'helpdesk.ticket', or 'bam.project'
--                                    as the fall-back for Bam rows without
--                                    a task.
--   entity_id        uuid         — id of the entity this activity is
--                                    about (task/deal/contact/company/ticket
--                                    /project).
--   project_id       uuid         — Bam project the row is scoped to.
--                                    NULL for bond rows (bond has no
--                                    project concept) and for helpdesk
--                                    rows whose ticket has no project_id.
--   organization_id  uuid         — organization the row belongs to.
--                                    NULL for Bam rows (projects.org_id
--                                    is loaded at query time via join to
--                                    avoid a second join here).
--                                    Present on bond. For helpdesk rows it
--                                    is loaded at query time via the
--                                    ticket/project joins in the route
--                                    handler.
--   actor_id         uuid         — user id of the actor. NULL for
--                                    system-generated bond/helpdesk rows.
--   actor_type       text         — remapped to platform vocabulary:
--                                    'human' | 'agent' | 'service'.
--                                    See LANDMINE block at top of file.
--   action           text         — free-form verb.
--   details          jsonb        — free-form details bag.
--   created_at       timestamptz  — normalized to activity_log.created_at,
--                                    bond_activities.performed_at, and
--                                    ticket_activity_log.created_at.
--
-- The route handler joins organization_id in where it is NULL on the view
-- (for Bam) so visibility gating can be done per-row without hauling the
-- full projects table into the view body.

CREATE OR REPLACE VIEW v_activity_unified AS
SELECT
    al.id                                                   AS id,
    'bam'::text                                             AS source_app,
    CASE WHEN al.task_id IS NOT NULL
         THEN 'bam.task'::text
         ELSE 'bam.project'::text
    END                                                     AS entity_type,
    COALESCE(al.task_id, al.project_id)                     AS entity_id,
    al.project_id                                           AS project_id,
    NULL::uuid                                              AS organization_id,
    al.actor_id                                             AS actor_id,
    al.actor_type::text                                     AS actor_type,
    al.action::text                                         AS action,
    al.details                                              AS details,
    al.created_at                                           AS created_at
FROM activity_log al

UNION ALL

SELECT
    ba.id                                                   AS id,
    'bond'::text                                            AS source_app,
    CASE
        WHEN ba.deal_id    IS NOT NULL THEN 'bond.deal'::text
        WHEN ba.contact_id IS NOT NULL THEN 'bond.contact'::text
        WHEN ba.company_id IS NOT NULL THEN 'bond.company'::text
        ELSE 'bond.activity'::text
    END                                                     AS entity_type,
    COALESCE(ba.deal_id, ba.contact_id, ba.company_id, ba.id) AS entity_id,
    NULL::uuid                                              AS project_id,
    ba.organization_id                                      AS organization_id,
    ba.performed_by                                         AS actor_id,
    -- Bond has no actor_type column; derive from users.kind when we have
    -- a performed_by FK, otherwise treat as 'service' (system-written).
    -- The LEFT JOIN below carries u.kind when present.
    COALESCE(u.kind::text, 'service')                       AS actor_type,
    ba.activity_type::text                                  AS action,
    jsonb_build_object(
        'subject',  ba.subject,
        'body',     ba.body,
        'metadata', ba.metadata
    )                                                       AS details,
    ba.performed_at                                         AS created_at
FROM bond_activities ba
LEFT JOIN users u ON u.id = ba.performed_by

UNION ALL

SELECT
    tal.id                                                  AS id,
    'helpdesk'::text                                        AS source_app,
    'helpdesk.ticket'::text                                 AS entity_type,
    tal.ticket_id                                           AS entity_id,
    NULL::uuid                                              AS project_id,
    NULL::uuid                                              AS organization_id,
    tal.actor_id                                            AS actor_id,
    -- REMAP: see LANDMINE block at top. 'agent' on the helpdesk side means
    -- a HUMAN support agent; it must become 'human' in the unified view
    -- so AI-actor filters never confuse it for AI activity.
    CASE tal.actor_type
        WHEN 'customer' THEN 'human'
        WHEN 'agent'    THEN 'human'
        WHEN 'system'   THEN 'service'
        ELSE                 'human'
    END                                                     AS actor_type,
    tal.action::text                                        AS action,
    tal.details                                             AS details,
    tal.created_at                                          AS created_at
FROM ticket_activity_log tal;

-- Document the view in-database so anyone running `\d+ v_activity_unified`
-- sees the actor_type remap rule without having to locate this migration.
COMMENT ON VIEW v_activity_unified IS
  'Wave 3 AGENTIC_TODO §5. UNION ALL over activity_log / bond_activities / '
  'ticket_activity_log. actor_type is remapped to the platform vocabulary '
  '(human | agent | service). Helpdesk actor_type=agent means HUMAN support '
  'agent and is remapped to human; do not confuse with platform agent '
  '(AI). See migration 0129 header for the full landmine note.';
