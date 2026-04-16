-- 0121_bolt_platform_trigger_source.sql
-- Why: Add 'platform' to the bolt_trigger_source enum so cross-cutting
-- platform-level events (starting with approval.requested from the new
-- apps/api POST /v1/approvals route) can be ingested. Same pattern as
-- 0041_bolt_extended_trigger_sources.sql, which was the prior additive
-- enum extension.
-- Client impact: additive only. Extends an existing enum.

ALTER TYPE bolt_trigger_source ADD VALUE IF NOT EXISTS 'platform';
