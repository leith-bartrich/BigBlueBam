-- 0104_brief_qdrant_embedded_at.sql
-- Why: Track which documents have been embedded for Qdrant semantic search. Enables resume-safe chunking, re-embed on update, and cleanup.
-- Client impact: additive only. New nullable column and index.

ALTER TABLE brief_documents
  ADD COLUMN IF NOT EXISTS qdrant_embedded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_brief_docs_qdrant_embedded
  ON brief_documents(organization_id, qdrant_embedded_at);
