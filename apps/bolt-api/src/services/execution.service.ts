import { eq, and, asc, desc, gt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  boltExecutions,
  boltExecutionSteps,
  boltAutomations,
} from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ExecutionError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'ExecutionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExecutionStatus = 'running' | 'success' | 'partial' | 'failed' | 'skipped';

export interface ListExecutionFilters {
  automationId: string;
  orgId: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export interface ListOrgExecutionFilters {
  orgId: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listExecutions(filters: ListExecutionFilters) {
  // Verify automation belongs to org
  const [automation] = await db
    .select({ id: boltAutomations.id })
    .from(boltAutomations)
    .where(
      and(
        eq(boltAutomations.id, filters.automationId),
        eq(boltAutomations.org_id, filters.orgId),
      ),
    )
    .limit(1);

  if (!automation) {
    throw new ExecutionError('NOT_FOUND', 'Automation not found', 404);
  }

  const conditions: any[] = [eq(boltExecutions.automation_id, filters.automationId)];

  if (filters.status) {
    conditions.push(eq(boltExecutions.status, filters.status as ExecutionStatus));
  }

  const limit = Math.min(filters.limit ?? 50, 100);

  if (filters.cursor) {
    conditions.push(gt(boltExecutions.started_at, new Date(filters.cursor)));
  }

  const rows = await db
    .select()
    .from(boltExecutions)
    .where(and(...conditions))
    .orderBy(desc(boltExecutions.started_at))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && data.length > 0 ? data[data.length - 1]!.started_at.toISOString() : null;

  return {
    data,
    meta: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

export async function getExecution(id: string, orgId: string) {
  const [execution] = await db
    .select()
    .from(boltExecutions)
    .where(eq(boltExecutions.id, id))
    .limit(1);

  if (!execution) return null;

  // Verify org isolation via the parent automation
  const [automation] = await db
    .select({ org_id: boltAutomations.org_id })
    .from(boltAutomations)
    .where(eq(boltAutomations.id, execution.automation_id))
    .limit(1);

  if (!automation || automation.org_id !== orgId) return null;

  const steps = await db
    .select()
    .from(boltExecutionSteps)
    .where(eq(boltExecutionSteps.execution_id, id))
    .orderBy(asc(boltExecutionSteps.step_index));

  return { ...execution, steps };
}

export async function listOrgExecutions(filters: ListOrgExecutionFilters) {
  // Get all automation IDs for the org
  const automationRows = await db
    .select({ id: boltAutomations.id })
    .from(boltAutomations)
    .where(eq(boltAutomations.org_id, filters.orgId));

  if (automationRows.length === 0) {
    return { data: [], meta: { next_cursor: null, has_more: false } };
  }

  const automationIds = automationRows.map((r) => r.id);

  const conditions: any[] = [
    sql`${boltExecutions.automation_id} = ANY(${automationIds})`,
  ];

  if (filters.status) {
    conditions.push(eq(boltExecutions.status, filters.status as ExecutionStatus));
  }

  const limit = Math.min(filters.limit ?? 50, 100);

  if (filters.cursor) {
    conditions.push(gt(boltExecutions.started_at, new Date(filters.cursor)));
  }

  const rows = await db
    .select({
      execution: boltExecutions,
      automation_name: boltAutomations.name,
    })
    .from(boltExecutions)
    .innerJoin(boltAutomations, eq(boltAutomations.id, boltExecutions.automation_id))
    .where(and(...conditions))
    .orderBy(desc(boltExecutions.started_at))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
    ...r.execution,
    automation_name: r.automation_name,
  }));
  const nextCursor =
    hasMore && data.length > 0 ? data[data.length - 1]!.started_at.toISOString() : null;

  return {
    data,
    meta: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

export async function retryExecution(executionId: string, orgId: string) {
  const existing = await getExecution(executionId, orgId);
  if (!existing) {
    throw new ExecutionError('NOT_FOUND', 'Execution not found', 404);
  }

  if (existing.status !== 'failed' && existing.status !== 'partial') {
    throw new ExecutionError(
      'BAD_REQUEST',
      `Cannot retry execution with status '${existing.status}'; must be failed or partial`,
      400,
    );
  }

  // Create a new execution record marked as running (actual execution is async via worker)
  const [newExecution] = await db
    .insert(boltExecutions)
    .values({
      automation_id: existing.automation_id,
      status: 'running',
      trigger_event: existing.trigger_event,
      conditions_met: true,
    })
    .returning();

  return newExecution!;
}
