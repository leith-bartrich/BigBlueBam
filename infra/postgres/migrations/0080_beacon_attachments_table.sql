-- 0080_beacon_attachments_table.sql
-- Why: Beacon spec §2.1.6 defines beacon_attachments for rich media. Frontend and Markdown body references require the table.
-- Client impact: additive only. New table, no existing rows affected.

CREATE TABLE IF NOT EXISTS beacon_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beacon_id       UUID NOT NULL REFERENCES beacon_entries(id) ON DELETE CASCADE,
    filename        VARCHAR(512) NOT NULL,
    content_type    VARCHAR(128) NOT NULL,
    size_bytes      BIGINT NOT NULL,
    storage_key     VARCHAR(1024) NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(beacon_id, filename)
);

CREATE INDEX IF NOT EXISTS idx_beacon_attachments_beacon_id ON beacon_attachments (beacon_id);
