import { eq, and, desc, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { activityLog } from '../db/schema/activity-log.js';
import { users } from '../db/schema/users.js';

/**
 * Append a row to the activity log.
 *
 * AGENTIC_TODO §10 / migration 0127 added `activity_log.actor_type`.
 * The column has a default of 'human', so callers that don't care about
 * agent auditing don't need to pass anything. Callers that DO want the
 * row stamped with the correct actor kind can:
 *
 *   a) Pass `actorType` explicitly (fast path — use this when the caller
 *      already knows it, e.g. the agent self-report route).
 *   b) Omit `actorType` entirely. The service falls back to SELECTing
 *      `users.kind` for the actor. One extra round-trip per write; cheap
 *      enough for Wave 1. Cache layering is a Wave 2 concern.
 *
 * Existing call sites continue to work unchanged: they omit `actorType`,
 * we look it up, and the row gets the correct kind. No call-site audit is
 * required.
 */
export async function logActivity(
  projectId: string,
  actorId: string,
  action: string,
  taskId?: string | null,
  details?: Record<string, unknown> | null,
  impersonatorId?: string | null,
  viaSuperuserContext?: boolean,
  actorType?: 'human' | 'agent' | 'service',
) {
  // When a SuperUser is acting via a switched org context
  // (sessions.active_org_id → request.viaSuperuserContext), tag the activity
  // entry so the audit log clearly distinguishes "SU acting in their own
  // org" from "SU acting on another tenant via context switch".
  const mergedDetails = viaSuperuserContext
    ? { ...(details ?? {}), via_superuser_context: true }
    : details ?? null;

  // Fallback path: resolve the actor's kind from users.kind.
  // Intentionally a single-row SELECT rather than a cache layer; typical
  // request already carries a handful of DB calls and this write is off
  // the hot read path.
  let resolvedActorType: 'human' | 'agent' | 'service' = actorType ?? 'human';
  if (!actorType) {
    const row = await db
      .select({ kind: users.kind })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);
    if (row[0]) resolvedActorType = row[0].kind;
  }

  const [entry] = await db
    .insert(activityLog)
    .values({
      project_id: projectId,
      actor_id: actorId,
      actor_type: resolvedActorType,
      impersonator_id: impersonatorId ?? null,
      action,
      task_id: taskId ?? null,
      details: mergedDetails,
    })
    .returning();

  return entry!;
}

export interface ActivityFilters {
  cursor?: string;
  limit?: number;
  action?: string;
}

export async function getProjectActivity(projectId: string, filters: ActivityFilters) {
  const limit = Math.min(filters.limit ?? 50, 200);
  const conditions = [eq(activityLog.project_id, projectId)];

  if (filters.cursor) {
    conditions.push(lt(activityLog.created_at, new Date(filters.cursor)));
  }

  const result = await db
    .select()
    .from(activityLog)
    .where(and(...conditions))
    .orderBy(desc(activityLog.created_at))
    .limit(limit + 1);

  const hasMore = result.length > limit;
  const data = hasMore ? result.slice(0, limit) : result;
  const nextCursor =
    hasMore && data.length > 0 ? data[data.length - 1]!.created_at.toISOString() : null;

  return {
    data,
    meta: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

export async function getTaskActivity(taskId: string) {
  const result = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.task_id, taskId))
    .orderBy(desc(activityLog.created_at));

  return result;
}
