-- 0041_bolt_extended_trigger_sources.sql
-- Why: Bolt event catalog was limited to 6 sources (bam, banter, beacon, brief,
-- helpdesk, schedule) but events are emitted from 14 apps. Extend the
-- bolt_trigger_source enum so bond/blast/board/bench/bearing/bill/book/blank
-- events are no longer silently rejected at ingest with HTTP 400.
-- Client impact: additive only — extends an existing enum.

ALTER TYPE bolt_trigger_source ADD VALUE IF NOT EXISTS 'bond';
ALTER TYPE bolt_trigger_source ADD VALUE IF NOT EXISTS 'blast';
ALTER TYPE bolt_trigger_source ADD VALUE IF NOT EXISTS 'board';
ALTER TYPE bolt_trigger_source ADD VALUE IF NOT EXISTS 'bench';
ALTER TYPE bolt_trigger_source ADD VALUE IF NOT EXISTS 'bearing';
ALTER TYPE bolt_trigger_source ADD VALUE IF NOT EXISTS 'bill';
ALTER TYPE bolt_trigger_source ADD VALUE IF NOT EXISTS 'book';
ALTER TYPE bolt_trigger_source ADD VALUE IF NOT EXISTS 'blank';
