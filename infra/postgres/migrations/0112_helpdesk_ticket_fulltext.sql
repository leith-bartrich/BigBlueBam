-- 0112_helpdesk_ticket_fulltext.sql
-- Why: Full-text search on tickets and ticket_messages. Generated tsvector columns and GIN indexes for fast ranked queries.
-- Client impact: additive only. No query behavior change until search.service.ts is wired.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(subject, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tickets_search_vector ON tickets USING GIN (search_vector);

ALTER TABLE ticket_messages
  ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(body, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_ticket_messages_search_vector ON ticket_messages USING GIN (search_vector);
