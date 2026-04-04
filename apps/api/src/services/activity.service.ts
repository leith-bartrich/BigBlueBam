import { eq, and, desc, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { activityLog } from '../db/schema/activity-log.js';

export async function logActivity(
  projectId: string,
  actorId: string,
  action: string,
  taskId?: string | null,
  details?: Record<string, unknown> | null,
  impersonatorId?: string | null,
) {
  const [entry] = await db
    .insert(activityLog)
    .values({
      project_id: projectId,
      actor_id: actorId,
      impersonator_id: impersonatorId ?? null,
      action,
      task_id: taskId ?? null,
      details: details ?? null,
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
  const limit = filters.limit ?? 50;
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
