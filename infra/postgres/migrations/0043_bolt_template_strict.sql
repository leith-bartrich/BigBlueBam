-- 0043_bolt_template_strict.sql
-- Why: Bolt rule authors need a way to opt into strict template resolution so
--      that unresolved {{ event.* }} paths fail the step loudly rather than
--      silently passing empty strings (or "[object Object]") to MCP tools.
--      This flag lets the worker abort a step when any template warning fires.
-- Client impact: additive only.

ALTER TABLE bolt_automations
  ADD COLUMN IF NOT EXISTS template_strict BOOLEAN NOT NULL DEFAULT false;
