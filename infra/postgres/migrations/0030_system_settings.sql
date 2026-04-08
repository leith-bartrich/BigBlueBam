-- 0030_system_settings.sql
-- Why: Add a generic key-value system_settings table for SuperUser-configured
--   platform options. First use: root_redirect controls where the domain root
--   (/) redirects to (marketing site, Bam, Banter, Helpdesk, etc.).
-- Client impact: additive only

CREATE TABLE IF NOT EXISTS system_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the default root redirect (marketing site)
INSERT INTO system_settings (key, value) VALUES
    ('root_redirect', '"site"')
ON CONFLICT (key) DO NOTHING;
