-- 0079_beacon_comments_table.sql
-- Why: Beacon spec §2.1.7 defines beacon_comments for inline discussion on beacons. Frontend references it in beacon-detail.tsx but the DB table does not exist.
-- Client impact: additive only. New table, no existing rows affected.

CREATE TABLE IF NOT EXISTS beacon_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beacon_id       UUID NOT NULL REFERENCES beacon_entries(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES beacon_comments(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id),
    body_markdown   TEXT NOT NULL,
    body_html       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beacon_comments_beacon_id ON beacon_comments (beacon_id, created_at);
CREATE INDEX IF NOT EXISTS idx_beacon_comments_parent_id ON beacon_comments (parent_id);
