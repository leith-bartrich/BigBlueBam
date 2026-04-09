-- 0032_board_system_templates.sql
-- Why: Install 10 system templates for Board across 5 categories (retro,
--   brainstorm, planning, architecture, strategy, general). These are available
--   to all installations (org_id IS NULL).
-- Client impact: additive only — inserts into board_templates.

-- Guard: only insert if no system templates exist yet
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM board_templates WHERE org_id IS NULL LIMIT 1) THEN
    RAISE NOTICE 'Board system templates already exist, skipping';
    RETURN;
  END IF;

  -- We need a valid user ID for created_by. Use the first user in the system.
  -- If no users exist yet (fresh install), the templates will be seeded by the
  -- seed script instead.
  DECLARE
    v_uid UUID;
  BEGIN
    SELECT id INTO v_uid FROM users LIMIT 1;
    IF v_uid IS NULL THEN
      RAISE NOTICE 'No users exist yet, skipping board template seed (run seed script after first user creation)';
      RETURN;
    END IF;

    INSERT INTO board_templates (org_id, name, description, icon, category, yjs_state, thumbnail_url, sort_order, created_by) VALUES
      -- Retro (3)
      (NULL, 'Start / Stop / Continue', 'Three color-coded frames for retrospective feedback', E'\U0001F504', 'retro', E'\\x7b7d', NULL, 0, v_uid),
      (NULL, '4Ls Retrospective', 'Liked, Learned, Lacked, Longed For — four quadrant frames', E'\U0001F4AD', 'retro', E'\\x7b7d', NULL, 1, v_uid),
      (NULL, 'Sailboat Retro', 'Wind (helps), Anchors (drags), Rocks (risks), Island (goals)', E'\u26F5', 'retro', E'\\x7b7d', NULL, 2, v_uid),
      -- Brainstorm (2)
      (NULL, 'Brainstorm', 'Central topic frame with space for radiating ideas', E'\U0001F4A1', 'brainstorm', E'\\x7b7d', NULL, 3, v_uid),
      (NULL, 'Affinity Map', 'Empty frames for grouping sticky notes by theme', E'\U0001F5C2', 'brainstorm', E'\\x7b7d', NULL, 4, v_uid),
      -- Planning (1)
      (NULL, 'User Story Map', 'Horizontal epic lanes with vertical priority columns', E'\U0001F4CB', 'planning', E'\\x7b7d', NULL, 5, v_uid),
      -- Architecture (2)
      (NULL, 'Architecture Diagram', 'Pre-positioned frames for Frontend, Backend, Database, External', E'\U0001F3DB', 'architecture', E'\\x7b7d', NULL, 6, v_uid),
      (NULL, 'Flowchart Starter', 'Start/end nodes with sample decision points and process boxes', E'\U0001F500', 'architecture', E'\\x7b7d', NULL, 7, v_uid),
      -- Strategy (1)
      (NULL, 'SWOT Analysis', '2x2 grid: Strengths, Weaknesses, Opportunities, Threats', E'\U0001F3AF', 'strategy', E'\\x7b7d', NULL, 8, v_uid),
      -- General (1)
      (NULL, 'Blank Canvas', 'Empty board with dots background', E'\U0001F4C4', 'general', E'\\x7b7d', NULL, 9, v_uid);

    RAISE NOTICE 'Inserted 10 board system templates';
  END;
END $$;
