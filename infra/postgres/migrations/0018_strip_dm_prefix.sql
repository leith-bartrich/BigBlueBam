-- ─────────────────────────────────────────────────────────────────────────
-- 0018_strip_dm_prefix.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: DM channels were stored with a "dm-<display_name>" prefix on
--      banter_channels.name. That leaked into the sidebar rendering and
--      the channel detail header as a literal label (e.g. "dm-Casey
--      O'Connor"), AND the value was relative to the creator's
--      perspective so the OTHER participant saw their own name. Going
--      forward, DM channel names are resolved at read time from the
--      other participant's display_name, but existing rows still carry
--      the prefix from the historical bug.
-- Client impact: cosmetic. Strips the leading "dm-" from existing DM
--      channel names. No row count changes, no FK impact.
-- ─────────────────────────────────────────────────────────────────────────

UPDATE banter_channels
SET name = SUBSTRING(name FROM 4)
WHERE type = 'dm'
  AND name LIKE 'dm-%'
  AND LENGTH(name) > 3;
