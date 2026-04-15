-- 0103_brief_yjs_state_tracking.sql
-- Why: Activate yjs_state column for Hocuspocus persistence. Track last-saved timestamp for debounce logic and to avoid redundant writes.
-- Client impact: additive only. New column and index. No data migration.

ALTER TABLE brief_documents
  ADD COLUMN IF NOT EXISTS yjs_last_saved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_brief_docs_yjs_lookup
  ON brief_documents(id, org_id)
  WHERE yjs_state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brief_docs_yjs_last_saved
  ON brief_documents(yjs_last_saved_at);
