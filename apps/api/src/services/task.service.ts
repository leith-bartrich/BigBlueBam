import { eq, and, sql, ilike, asc, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tasks } from '../db/schema/tasks.js';
import { projects } from '../db/schema/projects.js';
import { phases } from '../db/schema/phases.js';
import { tickets, ticketMessages } from '../db/schema/tickets.js';
import type { CreateTaskInput, UpdateTaskInput, MoveTaskInput, BulkUpdateInput } from '@bigbluebam/shared';
import { broadcastToProject } from './realtime.service.js';
import { logActivity } from './activity.service.js';

export async function createTask(
  projectId: string,
  data: CreateTaskInput,
  reporterId: string,
  impersonatorId?: string | null,
) {
  // Atomically increment task_id_sequence and get new value
  const [updated] = await db
    .update(projects)
    .set({
      task_id_sequence: sql`${projects.task_id_sequence} + 1`,
    })
    .where(eq(projects.id, projectId))
    .returning({
      task_id_prefix: projects.task_id_prefix,
      task_id_sequence: projects.task_id_sequence,
    });

  if (!updated) {
    throw new TaskError('NOT_FOUND', 'Project not found', 404);
  }

  const humanId = `${updated.task_id_prefix}-${updated.task_id_sequence}`;

  // If no state_id provided and phase has auto_state_on_enter, use it
  let stateId = data.state_id ?? null;
  if (!stateId) {
    const [phase] = await db
      .select()
      .from(phases)
      .where(eq(phases.id, data.phase_id))
      .limit(1);

    if (phase?.auto_state_on_enter) {
      stateId = phase.auto_state_on_enter;
    }
  }

  const [task] = await db
    .insert(tasks)
    .values({
      project_id: projectId,
      human_id: humanId,
      parent_task_id: data.parent_task_id ?? null,
      title: data.title,
      description: data.description ?? null,
      phase_id: data.phase_id,
      state_id: stateId,
      sprint_id: data.sprint_id ?? null,
      epic_id: data.epic_id ?? null,
      assignee_id: data.assignee_id ?? null,
      reporter_id: reporterId,
      priority: data.priority ?? 'medium',
      story_points: data.story_points ?? null,
      time_estimate_minutes: data.time_estimate_minutes ?? null,
      start_date: data.start_date ?? null,
      due_date: data.due_date ?? null,
      labels: data.label_ids ?? [],
      custom_fields: data.custom_fields ?? {},
      position: await getNextPosition(data.phase_id),
    })
    .returning();

  // Update subtask_count on parent if this is a subtask
  if (data.parent_task_id) {
    await db
      .update(tasks)
      .set({
        subtask_count: sql`${tasks.subtask_count} + 1`,
        updated_at: new Date(),
      })
      .where(eq(tasks.id, data.parent_task_id));
  }

  // Broadcast realtime event
  broadcastToProject(projectId, 'task.created', task, reporterId);

  // Log activity
  logActivity(projectId, reporterId, 'task.created', task!.id, { title: task!.title }, impersonatorId ?? null).catch(() => {});

  return task!;
}

async function getNextPosition(phaseId: string): Promise<number> {
  const result = await db
    .select({ maxPos: sql<number>`coalesce(max(${tasks.position}), 0)` })
    .from(tasks)
    .where(eq(tasks.phase_id, phaseId));

  return (result[0]?.maxPos ?? 0) + 1024;
}

export async function getTask(taskId: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  return task ?? null;
}

export async function updateTask(taskId: string, data: UpdateTaskInput, actorId?: string, impersonatorId?: string | null) {
  const updateValues: Record<string, unknown> = {
    updated_at: new Date(),
  };

  const changedFields: string[] = [];
  if (data.title !== undefined) { updateValues.title = data.title; changedFields.push('title'); }
  if (data.description !== undefined) { updateValues.description = data.description; changedFields.push('description'); }
  if (data.phase_id !== undefined) { updateValues.phase_id = data.phase_id; changedFields.push('phase_id'); }
  if (data.state_id !== undefined) { updateValues.state_id = data.state_id; changedFields.push('state_id'); }
  if (data.sprint_id !== undefined) { updateValues.sprint_id = data.sprint_id; changedFields.push('sprint_id'); }
  if (data.epic_id !== undefined) { updateValues.epic_id = data.epic_id; changedFields.push('epic_id'); }
  if (data.assignee_id !== undefined) { updateValues.assignee_id = data.assignee_id; changedFields.push('assignee_id'); }
  if (data.priority !== undefined) { updateValues.priority = data.priority; changedFields.push('priority'); }
  if (data.story_points !== undefined) { updateValues.story_points = data.story_points; changedFields.push('story_points'); }
  if (data.time_estimate_minutes !== undefined) { updateValues.time_estimate_minutes = data.time_estimate_minutes; changedFields.push('time_estimate_minutes'); }
  if (data.start_date !== undefined) { updateValues.start_date = data.start_date; changedFields.push('start_date'); }
  if (data.due_date !== undefined) { updateValues.due_date = data.due_date; changedFields.push('due_date'); }
  if (data.label_ids !== undefined) { updateValues.labels = data.label_ids; changedFields.push('labels'); }
  if (data.parent_task_id !== undefined) { updateValues.parent_task_id = data.parent_task_id; changedFields.push('parent_task_id'); }
  if (data.custom_fields !== undefined) { updateValues.custom_fields = data.custom_fields; changedFields.push('custom_fields'); }

  const [task] = await db
    .update(tasks)
    .set(updateValues)
    .where(eq(tasks.id, taskId))
    .returning();

  // Broadcast realtime event
  if (task) {
    broadcastToProject(task.project_id, 'task.updated', {
      id: taskId,
      changes: data,
      task,
    });

    // Log activity
    if (actorId) {
      logActivity(task.project_id, actorId, 'task.updated', taskId, { changed_fields: changedFields }, impersonatorId ?? null).catch(() => {});
    }
  }

  return task ?? null;
}

export async function deleteTask(taskId: string, actorId?: string, impersonatorId?: string | null) {
  // Soft delete by moving to a terminal state - or we do actual delete
  // For now, actually delete but handle subtask counts
  const task = await getTask(taskId);
  if (!task) return null;

  if (task.parent_task_id) {
    await db
      .update(tasks)
      .set({
        subtask_count: sql`greatest(${tasks.subtask_count} - 1, 0)`,
        updated_at: new Date(),
      })
      .where(eq(tasks.id, task.parent_task_id));
  }

  const [deleted] = await db
    .delete(tasks)
    .where(eq(tasks.id, taskId))
    .returning();

  // Broadcast realtime event
  if (deleted) {
    broadcastToProject(deleted.project_id, 'task.deleted', {
      id: taskId,
      task: deleted,
    });

    // Log activity
    if (actorId) {
      logActivity(deleted.project_id, actorId, 'task.deleted', null, { task_id: taskId, title: deleted.title }, impersonatorId ?? null).catch(() => {});
    }
  }

  return deleted ?? null;
}

export async function moveTask(taskId: string, data: MoveTaskInput, actorId?: string, impersonatorId?: string | null) {
  // Get the task before move to know from_phase
  const existingTask = await getTask(taskId);

  const updateValues: Record<string, unknown> = {
    phase_id: data.phase_id,
    position: data.position,
    updated_at: new Date(),
  };

  if (data.sprint_id !== undefined) {
    updateValues.sprint_id = data.sprint_id;
  }

  // Check if phase has auto_state_on_enter
  const [phase] = await db
    .select()
    .from(phases)
    .where(eq(phases.id, data.phase_id))
    .limit(1);

  if (phase?.auto_state_on_enter) {
    updateValues.state_id = phase.auto_state_on_enter;
  }

  // If moving to terminal phase, set completed_at
  if (phase?.is_terminal) {
    updateValues.completed_at = new Date();
  } else {
    // Clear completed_at when leaving terminal phase
    updateValues.completed_at = null;
  }

  const [task] = await db
    .update(tasks)
    .set(updateValues)
    .where(eq(tasks.id, taskId))
    .returning();

  // Sync ticket status if this task is linked to a helpdesk ticket
  try {
    const ticketSync = await db
      .select()
      .from(tickets)
      .where(eq(tickets.task_id, taskId))
      .limit(1);

    if (ticketSync.length > 0) {
      const ticket = ticketSync[0]!;
      // Map phase to ticket status
      let newStatus = ticket.status;
      if (phase?.is_terminal) {
        newStatus = 'resolved';
      } else if (phase?.is_start) {
        newStatus = 'open';
      } else {
        newStatus = 'in_progress';
      }

      if (newStatus !== ticket.status) {
        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'resolved') updates.resolved_at = new Date();

        await db.update(tickets).set(updates).where(eq(tickets.id, ticket.id));

        // Create a status change message
        await db.insert(ticketMessages).values({
          ticket_id: ticket.id,
          author_type: 'system',
          author_id: actorId ?? '00000000-0000-0000-0000-000000000000',
          author_name: 'System',
          body: `Status changed to ${newStatus.replace('_', ' ')}`,
          is_internal: false,
        });
      }
    }
  } catch {
    // Don't fail the task move if ticket sync fails
  }

  // Broadcast realtime event
  if (task) {
    broadcastToProject(task.project_id, 'task.moved', {
      id: taskId,
      phase_id: data.phase_id,
      position: data.position,
      task,
    });

    // Log activity
    if (actorId) {
      logActivity(task.project_id, actorId, 'task.moved', taskId, {
        from_phase: existingTask?.phase_id,
        to_phase: data.phase_id,
      }, impersonatorId ?? null).catch(() => {});
    }
  }

  return task ?? null;
}

export interface ListTasksFilters {
  sprint_id?: string;
  phase_id?: string;
  state_id?: string;
  assignee_id?: string;
  priority?: string;
  labels?: string[];
  search?: string;
  cursor?: string;
  limit?: number;
}

export async function listTasks(projectId: string, filters: ListTasksFilters) {
  const conditions = [eq(tasks.project_id, projectId)];

  if (filters.sprint_id) {
    conditions.push(eq(tasks.sprint_id, filters.sprint_id));
  }
  if (filters.phase_id) {
    conditions.push(eq(tasks.phase_id, filters.phase_id));
  }
  if (filters.state_id) {
    conditions.push(eq(tasks.state_id, filters.state_id));
  }
  if (filters.assignee_id) {
    conditions.push(eq(tasks.assignee_id, filters.assignee_id));
  }
  if (filters.priority) {
    conditions.push(eq(tasks.priority, filters.priority));
  }
  if (filters.search) {
    conditions.push(ilike(tasks.title, `%${filters.search}%`));
  }
  if (filters.labels && filters.labels.length > 0) {
    conditions.push(sql`${tasks.labels} && ARRAY[${sql.join(filters.labels.map(l => sql`${l}::uuid`), sql`,`)}]`);
  }

  const limit = filters.limit ?? 50;

  if (filters.cursor) {
    conditions.push(gt(tasks.created_at, new Date(filters.cursor)));
  }

  const result = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.created_at))
    .limit(limit + 1);

  const hasMore = result.length > limit;
  const data = hasMore ? result.slice(0, limit) : result;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.created_at.toISOString() : null;

  return {
    data,
    meta: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

export async function getBoardState(projectId: string, sprintId?: string) {
  const projectPhases = await db
    .select()
    .from(phases)
    .where(eq(phases.project_id, projectId))
    .orderBy(asc(phases.position));

  const taskConditions = [eq(tasks.project_id, projectId)];
  if (sprintId) {
    taskConditions.push(eq(tasks.sprint_id, sprintId));
  }

  const allTasks = await db
    .select()
    .from(tasks)
    .where(and(...taskConditions))
    .orderBy(asc(tasks.position));

  // Group tasks by phase (skip tasks with null phase_id)
  const tasksByPhase = new Map<string, typeof allTasks>();
  for (const task of allTasks) {
    if (!task.phase_id) continue;
    const list = tasksByPhase.get(task.phase_id) ?? [];
    list.push(task);
    tasksByPhase.set(task.phase_id, list);
  }

  return projectPhases.map((phase) => ({
    ...phase,
    tasks: tasksByPhase.get(phase.id) ?? [],
  }));
}

export async function bulkOperations(data: BulkUpdateInput, _userId: string) {
  const results: Array<{ task_id: string; success: boolean; error?: string }> = [];

  for (const taskId of data.task_ids) {
    try {
      if (data.operation === 'update' && data.fields) {
        await updateTask(taskId, data.fields as UpdateTaskInput);
        results.push({ task_id: taskId, success: true });
      } else if (data.operation === 'delete') {
        await deleteTask(taskId);
        results.push({ task_id: taskId, success: true });
      } else if (data.operation === 'move' && data.fields) {
        await moveTask(taskId, data.fields as MoveTaskInput);
        results.push({ task_id: taskId, success: true });
      }
    } catch (err) {
      results.push({
        task_id: taskId,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
}

export class TaskError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'TaskError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
