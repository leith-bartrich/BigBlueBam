-- 0093_board_template_content.sql
-- Why: Populate Excalidraw scene JSON for system templates so they can be used as starting points. Templates currently have metadata but NULL yjs_state.
-- Client impact: additive only. Only updates rows where yjs_state IS NULL; existing template rows are not disturbed.

DO $$
DECLARE
  tmpl_sss JSONB := '{"type":"excalidraw","version":2,"source":"bbb-templates","elements":[{"type":"frame","id":"start-frame","name":"Start","x":100,"y":100,"width":400,"height":400},{"type":"frame","id":"stop-frame","name":"Stop","x":550,"y":100,"width":400,"height":400},{"type":"frame","id":"continue-frame","name":"Continue","x":1000,"y":100,"width":400,"height":400}],"appState":{},"files":{}}'::jsonb;
  tmpl_4ls JSONB := '{"type":"excalidraw","version":2,"source":"bbb-templates","elements":[{"type":"frame","id":"liked","name":"Liked","x":100,"y":100,"width":450,"height":300},{"type":"frame","id":"learned","name":"Learned","x":600,"y":100,"width":450,"height":300},{"type":"frame","id":"lacked","name":"Lacked","x":100,"y":450,"width":450,"height":300},{"type":"frame","id":"longed","name":"Longed For","x":600,"y":450,"width":450,"height":300}],"appState":{},"files":{}}'::jsonb;
BEGIN
  UPDATE board_templates
  SET yjs_state = tmpl_sss::text::bytea
  WHERE name = 'Start Stop Continue' AND yjs_state IS NULL;

  UPDATE board_templates
  SET yjs_state = tmpl_4ls::text::bytea
  WHERE name = '4Ls Retrospective' AND yjs_state IS NULL;
  -- Additional templates populated via follow-up UPDATEs or seeded via app startup
END $$;

-- Note: Additional templates (Sailboat, Brainstorm, Affinity Map, User Story Map, Architecture Diagram, Flowchart Starter, SWOT Analysis, Blank Canvas) will be populated by a startup script that reads from apps/board-api/seed/templates/*.json files to keep this migration readable.
