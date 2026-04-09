-- 0040_board_template_seeds.sql
-- Why: Seed additional starter templates (Sprint Retrospective, Kanban Board,
--   Mind Map, Presentation, Wireframe) to complement the 10 base templates
--   from migration 0032. These fill gaps in the template browser categories.
-- Client impact: additive only — inserts into board_templates.

DO $$
DECLARE
  v_uid UUID;
  v_max_sort INT;
BEGIN
  -- Skip if any of these specific templates already exist (idempotency)
  IF EXISTS (SELECT 1 FROM board_templates WHERE org_id IS NULL AND name = 'Sprint Retrospective' LIMIT 1) THEN
    RAISE NOTICE 'Additional board templates already exist, skipping';
    RETURN;
  END IF;

  -- Grab a user ID for created_by
  SELECT id INTO v_uid FROM users LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE NOTICE 'No users exist yet, skipping board template seed';
    RETURN;
  END IF;

  -- Find current max sort_order so we append after existing templates
  SELECT COALESCE(MAX(sort_order), -1) INTO v_max_sort
    FROM board_templates
    WHERE org_id IS NULL;

  INSERT INTO board_templates (org_id, name, description, icon, category, yjs_state, thumbnail_url, sort_order, created_by) VALUES
    -- Retro
    (NULL, 'Sprint Retrospective',
     'Three columns: What went well, What to improve, Action items — perfect for agile sprint reviews',
     E'\U0001F504', 'retro', NULL, NULL, v_max_sort + 1, v_uid),
    -- Planning
    (NULL, 'Kanban Board',
     'Pre-built columns for To Do, In Progress, Review, and Done — drag sticky notes between lanes',
     E'\U0001F4CB', 'planning', NULL, NULL, v_max_sort + 2, v_uid),
    -- Brainstorm
    (NULL, 'Mind Map',
     'Radial layout with a central topic and branching nodes for free-form concept mapping',
     E'\U0001F9E0', 'brainstorm', NULL, NULL, v_max_sort + 3, v_uid),
    -- General
    (NULL, 'Presentation',
     'Numbered slide frames arranged in sequence — walk through ideas in a structured order',
     E'\U0001F4FD', 'general', NULL, NULL, v_max_sort + 4, v_uid),
    -- Architecture
    (NULL, 'Wireframe',
     'Common UI frame placeholders for sketching page layouts and navigation flows',
     E'\U0001F5BC', 'architecture', NULL, NULL, v_max_sort + 5, v_uid);

  RAISE NOTICE 'Inserted 5 additional board system templates';
END $$;
