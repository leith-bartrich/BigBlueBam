// §12 Wave 5 bolt observability
// ---------------------------------------------------------------------------
// Event-trace service: given a Bolt ingest event_id or a (source, event, since)
// filter, returns a shape suitable for the bolt_event_trace and
// bolt_recent_events MCP tools.
//
// Trace shape per execution:
//   {
//     execution_id, automation_id, automation_name, status, started_at,
//     matched: boolean (conditions_met),
//     rules: [{ rule_id, rule_name, matched, conditions: [...], actions: [...] }]
//   }
//
// In the current single-rule-per-automation model every execution contributes
// exactly one rule entry. Condition results come from the evaluation_trace
// column (populated at ingestion time), with a fallback to the older
// condition_log jsonb for executions that predate migration 0138. Action
// outcomes are derived from bolt_execution_steps so we do not have to keep
// the worker in lockstep with the evaluation_trace schema.
// ---------------------------------------------------------------------------

import { and, eq, gte, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  boltExecutions,
  boltExecutionSteps,
  boltAutomations,
} from '../db/schema/index.js';

const MAX_FIELD_LEN = 1024; // 1KB cap on per-field actual/expected strings

function truncate(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') {
    return v.length > MAX_FIELD_LEN ? v.slice(0, MAX_FIELD_LEN) + '…' : v;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  // objects / arrays: serialize and truncate
  try {
    const s = JSON.stringify(v);
    return s.length > MAX_FIELD_LEN ? s.slice(0, MAX_FIELD_LEN) + '…' : v;
  } catch {
    return '[unserializable]';
  }
}

export interface TraceCondition {
  condition_id: string | null;
  operator: string;
  field: string;
  result: boolean;
  actual: unknown;
  expected: unknown;
}

export interface TraceAction {
  mcp_tool: string;
  outcome: string;
  duration_ms: number | null;
  error?: string;
}

export interface TraceRule {
  rule_id: string;
  rule_name: string;
  matched: boolean;
  conditions: TraceCondition[];
  actions: TraceAction[];
}

export interface TraceEntry {
  execution_id: string;
  automation_id: string;
  automation_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  event_id: string | null;
  event_source: string | null;
  event_type: string | null;
  rules: TraceRule[];
}

function normalizeConditions(
  evaluationTrace: unknown,
  conditionLog: unknown,
): TraceCondition[] {
  // Prefer evaluation_trace shape (array of rules) when present.
  if (Array.isArray(evaluationTrace) && evaluationTrace.length > 0) {
    const first = evaluationTrace[0] as { conditions?: unknown };
    if (Array.isArray(first?.conditions)) {
      return (first.conditions as any[]).map((c) => ({
        condition_id: typeof c.condition_id === 'string' ? c.condition_id : null,
        operator: String(c.operator ?? ''),
        field: String(c.field ?? ''),
        result: c.result === true,
        actual: truncate(c.actual),
        expected: truncate(c.expected),
      }));
    }
  }
  // Fallback to legacy condition_log (ConditionLogEntry[]).
  if (Array.isArray(conditionLog)) {
    return (conditionLog as any[]).map((c) => ({
      condition_id: null,
      operator: String(c.operator ?? ''),
      field: String(c.field ?? ''),
      result: c.result === true,
      actual: truncate(c.actual),
      expected: truncate(c.expected),
    }));
  }
  return [];
}

function stepOutcome(status: string): string {
  // bolt_execution_steps.status is 'success' | 'failed' | 'skipped' in practice.
  return status;
}

async function buildTraceRows(
  rows: Array<{
    execution: typeof boltExecutions.$inferSelect;
    automation_name: string;
  }>,
): Promise<TraceEntry[]> {
  if (rows.length === 0) return [];

  const executionIds = rows.map((r) => r.execution.id);
  const allSteps = await db
    .select()
    .from(boltExecutionSteps)
    .where(
      sql`${boltExecutionSteps.execution_id} IN (${sql.join(
        executionIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    );

  const stepsByExec = new Map<string, typeof allSteps>();
  for (const s of allSteps) {
    const list = stepsByExec.get(s.execution_id) ?? [];
    list.push(s);
    stepsByExec.set(s.execution_id, list);
  }

  return rows.map(({ execution, automation_name }) => {
    const conditions = normalizeConditions(
      execution.evaluation_trace,
      execution.condition_log,
    );

    const steps = (stepsByExec.get(execution.id) ?? []).sort(
      (a, b) => a.step_index - b.step_index,
    );
    const actions: TraceAction[] = steps.map((s: any) => ({
      mcp_tool: s.mcp_tool ?? '',
      outcome: stepOutcome(s.status ?? ''),
      duration_ms: typeof s.duration_ms === 'number' ? s.duration_ms : null,
      ...(s.error_message ? { error: String(s.error_message).slice(0, MAX_FIELD_LEN) } : {}),
    }));

    // Extract event metadata from trigger_event jsonb (populated at ingest).
    const triggerEvent = (execution.trigger_event ?? null) as
      | Record<string, unknown>
      | null;
    const eventSource =
      triggerEvent && typeof triggerEvent._source === 'string'
        ? (triggerEvent._source as string)
        : null;
    const eventType =
      triggerEvent && typeof triggerEvent._event_type === 'string'
        ? (triggerEvent._event_type as string)
        : null;

    return {
      execution_id: execution.id,
      automation_id: execution.automation_id,
      automation_name,
      status: execution.status,
      started_at: execution.started_at.toISOString(),
      completed_at: execution.completed_at
        ? execution.completed_at.toISOString()
        : null,
      event_id: execution.event_id ?? null,
      event_source: eventSource,
      event_type: eventType,
      rules: [
        {
          rule_id: execution.automation_id,
          rule_name: automation_name,
          matched: execution.conditions_met,
          conditions,
          actions,
        },
      ],
    };
  });
}

/**
 * Return every execution that was triggered by the given ingest event_id,
 * scoped to the caller's org. An empty array is a valid result (the event
 * hit zero rules).
 */
export async function getTraceByEventId(
  eventId: string,
  orgId: string,
): Promise<TraceEntry[]> {
  const rows = await db
    .select({
      execution: boltExecutions,
      automation_name: boltAutomations.name,
      org_id: boltAutomations.org_id,
    })
    .from(boltExecutions)
    .innerJoin(
      boltAutomations,
      eq(boltAutomations.id, boltExecutions.automation_id),
    )
    .where(
      and(
        eq(boltExecutions.event_id, eventId),
        eq(boltAutomations.org_id, orgId),
      ),
    )
    .orderBy(desc(boltExecutions.started_at));

  return buildTraceRows(
    rows.map((r) => ({
      execution: r.execution,
      automation_name: r.automation_name,
    })),
  );
}

export interface RecentEventFilters {
  orgId: string;
  source?: string;
  event?: string;
  since?: string; // ISO timestamp
  limit?: number;
}

export interface RecentEventSummary {
  event_id: string | null;
  source: string | null;
  event_type: string | null;
  started_at: string;
  matched_automations: number;
  first_execution_id: string;
}

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

/**
 * Return a compact list of recent ingest events that produced at least one
 * execution, filtered optionally by source / event / since. The server caps
 * the limit at MAX_LIMIT regardless of caller input.
 */
export async function listRecentEvents(
  filters: RecentEventFilters,
): Promise<RecentEventSummary[]> {
  const limit = Math.min(
    Math.max(filters.limit ?? DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  const conditions: any[] = [eq(boltAutomations.org_id, filters.orgId)];

  if (filters.source) {
    conditions.push(
      sql`${boltExecutions.trigger_event}->>'_source' = ${filters.source}`,
    );
  }
  if (filters.event) {
    conditions.push(
      sql`${boltExecutions.trigger_event}->>'_event_type' = ${filters.event}`,
    );
  }
  if (filters.since) {
    const sinceDate = new Date(filters.since);
    if (!Number.isNaN(sinceDate.getTime())) {
      conditions.push(gte(boltExecutions.started_at, sinceDate));
    }
  }

  // One summary row per event_id: aggregate the execution count and take the
  // earliest started_at as the event timestamp. event_id IS NULL rows (legacy
  // or ingest-less insertions) are excluded because they cannot be looked up.
  const rows = await db
    .select({
      event_id: boltExecutions.event_id,
      source: sql<string>`(${boltExecutions.trigger_event}->>'_source')`,
      event_type: sql<string>`(${boltExecutions.trigger_event}->>'_event_type')`,
      started_at: sql<Date>`MIN(${boltExecutions.started_at})`,
      matched: sql<number>`COUNT(*)::int`,
      first_execution_id: sql<string>`(ARRAY_AGG(${boltExecutions.id} ORDER BY ${boltExecutions.started_at} ASC))[1]`,
    })
    .from(boltExecutions)
    .innerJoin(
      boltAutomations,
      eq(boltAutomations.id, boltExecutions.automation_id),
    )
    .where(and(sql`${boltExecutions.event_id} IS NOT NULL`, ...conditions))
    .groupBy(
      boltExecutions.event_id,
      sql`(${boltExecutions.trigger_event}->>'_source')`,
      sql`(${boltExecutions.trigger_event}->>'_event_type')`,
    )
    .orderBy(sql`MIN(${boltExecutions.started_at}) DESC`)
    .limit(limit);

  return rows.map((r) => ({
    event_id: r.event_id ?? null,
    source: r.source ?? null,
    event_type: r.event_type ?? null,
    started_at:
      r.started_at instanceof Date
        ? r.started_at.toISOString()
        : String(r.started_at),
    matched_automations: Number(r.matched ?? 0),
    first_execution_id: r.first_execution_id,
  }));
}
