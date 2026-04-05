import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sprints } from '../db/schema/sprints.js';
import { tasks } from '../db/schema/tasks.js';
import { phases } from '../db/schema/phases.js';

export interface BurndownDay {
  date: string;
  remaining_points: number;
  ideal_points: number;
}

export interface BurndownReport {
  sprint: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    total_points: number;
  };
  days: BurndownDay[];
}

export interface VelocityReport {
  sprints: Array<{
    id: string;
    name: string;
    end_date: string | null;
    committed_points: number;
    completed_points: number;
  }>;
}

export interface CfdReport {
  phases: Array<{ id: string; name: string; order: number; color: string | null }>;
  days: Array<{ date: string; counts: Record<string, number> }>;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function eachDay(startStr: string, endStr: string): string[] {
  const out: string[] = [];
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  for (
    let d = new Date(start);
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(toDateStr(d));
  }
  return out;
}

/**
 * Build a sprint burndown. Uses `tasks.completed_at` as a proxy for when a
 * task crossed into a terminal phase. Ideal descent is a straight line from
 * the starting total down to zero across the sprint window.
 */
export async function buildBurndown(
  sprintId: string,
): Promise<BurndownReport | null> {
  const [sprint] = await db
    .select()
    .from(sprints)
    .where(eq(sprints.id, sprintId))
    .limit(1);
  if (!sprint) return null;

  const sprintTasks = await db
    .select({
      id: tasks.id,
      story_points: tasks.story_points,
      completed_at: tasks.completed_at,
    })
    .from(tasks)
    .where(eq(tasks.sprint_id, sprintId));

  const totalPoints = sprintTasks.reduce(
    (sum, t) => sum + (t.story_points ?? 0),
    0,
  );

  const startStr =
    sprint.start_date ?? toDateStr(sprint.created_at);
  const endStr =
    sprint.end_date ?? toDateStr(new Date());
  const todayStr = toDateStr(new Date());
  const effectiveEnd = endStr > todayStr ? todayStr : endStr;

  // Full window (for ideal line) and actual window (for data points).
  const fullDays = eachDay(startStr, endStr);
  const actualDays = eachDay(startStr, effectiveEnd);
  const span = Math.max(fullDays.length - 1, 1);

  const days: BurndownDay[] = fullDays.map((date, idx) => {
    const ideal =
      Math.round((totalPoints - (totalPoints * idx) / span) * 10) / 10;

    // Only compute actual up to today; project future days to the last known
    // remaining value so the client doesn't have to branch.
    if (idx < actualDays.length) {
      const dayEnd = new Date(date + 'T23:59:59.999Z');
      const completedPoints = sprintTasks
        .filter((t) => t.completed_at && t.completed_at <= dayEnd)
        .reduce((sum, t) => sum + (t.story_points ?? 0), 0);
      return {
        date,
        remaining_points: totalPoints - completedPoints,
        ideal_points: ideal,
      };
    }
    return { date, remaining_points: totalPoints, ideal_points: ideal };
  });

  // For future days (beyond today) leave remaining_points out by clamping to
  // the last known real value.
  const lastRealIdx = actualDays.length - 1;
  if (lastRealIdx >= 0) {
    const lastRemaining = days[lastRealIdx]!.remaining_points;
    for (let i = lastRealIdx + 1; i < days.length; i++) {
      days[i]!.remaining_points = lastRemaining;
    }
  }

  return {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      start_date: sprint.start_date,
      end_date: sprint.end_date,
      total_points: totalPoints,
    },
    days,
  };
}

/**
 * Velocity across the last N completed sprints, oldest first. "Committed" is
 * approximated by current sprint membership; "completed" is approximated by
 * tasks.completed_at having been set by sprint end_date (or close_at).
 */
export async function buildVelocity(
  projectId: string,
  limit: number,
): Promise<VelocityReport> {
  const completedSprints = await db
    .select({
      id: sprints.id,
      name: sprints.name,
      end_date: sprints.end_date,
      closed_at: sprints.closed_at,
    })
    .from(sprints)
    .where(
      and(
        eq(sprints.project_id, projectId),
        eq(sprints.status, 'completed'),
      ),
    )
    .orderBy(desc(sprints.closed_at))
    .limit(limit);

  if (completedSprints.length === 0) return { sprints: [] };

  const ids = completedSprints.map((s) => s.id);
  const sprintTasks = await db
    .select({
      sprint_id: tasks.sprint_id,
      story_points: tasks.story_points,
      completed_at: tasks.completed_at,
    })
    .from(tasks)
    .where(inArray(tasks.sprint_id, ids));

  const byId = new Map<
    string,
    { committed: number; completed: number; cutoff: Date | null }
  >();
  for (const s of completedSprints) {
    const cutoff = s.closed_at
      ? s.closed_at
      : s.end_date
        ? new Date(s.end_date + 'T23:59:59.999Z')
        : null;
    byId.set(s.id, { committed: 0, completed: 0, cutoff });
  }

  for (const t of sprintTasks) {
    if (!t.sprint_id) continue;
    const entry = byId.get(t.sprint_id);
    if (!entry) continue;
    const pts = t.story_points ?? 0;
    entry.committed += pts;
    if (
      t.completed_at &&
      (entry.cutoff === null || t.completed_at <= entry.cutoff)
    ) {
      entry.completed += pts;
    }
  }

  const out = completedSprints
    .map((s) => ({
      id: s.id,
      name: s.name,
      end_date: s.end_date,
      committed_points: byId.get(s.id)?.committed ?? 0,
      completed_points: byId.get(s.id)?.completed ?? 0,
    }))
    .reverse();

  return { sprints: out };
}

/**
 * Cumulative flow diagram. We only know each task's *current* phase, so we
 * walk backward from today by undoing each task's completion: for any day
 * before task.completed_at we treat the task as living in the first
 * non-terminal phase. This is coarse but gives a usable stacked area chart
 * without a full activity-log replay.
 */
export async function buildCfd(
  projectId: string,
  sprintId: string | null,
  fallbackDays: number,
): Promise<CfdReport | null> {
  const projectPhases = await db
    .select()
    .from(phases)
    .where(eq(phases.project_id, projectId))
    .orderBy(asc(phases.position));

  if (projectPhases.length === 0) {
    return { phases: [], days: [] };
  }

  let startStr: string;
  let endStr: string;
  if (sprintId) {
    const [sprint] = await db
      .select()
      .from(sprints)
      .where(eq(sprints.id, sprintId))
      .limit(1);
    if (!sprint) return null;
    startStr = sprint.start_date ?? toDateStr(sprint.created_at);
    endStr = sprint.end_date ?? toDateStr(new Date());
  } else {
    const today = new Date();
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - (fallbackDays - 1));
    startStr = toDateStr(start);
    endStr = toDateStr(today);
  }

  const todayStr = toDateStr(new Date());
  const effectiveEnd = endStr > todayStr ? todayStr : endStr;
  const dayList = eachDay(startStr, effectiveEnd);

  // Pull the population of tasks (for the sprint or whole project).
  const whereClauses = sprintId
    ? [eq(tasks.sprint_id, sprintId)]
    : [eq(tasks.project_id, projectId)];
  const projectTasks = await db
    .select({
      id: tasks.id,
      phase_id: tasks.phase_id,
      created_at: tasks.created_at,
      completed_at: tasks.completed_at,
    })
    .from(tasks)
    .where(and(...whereClauses));

  const terminalPhase = projectPhases.find((p) => p.is_terminal);
  const firstNonTerminal =
    projectPhases.find((p) => !p.is_terminal) ?? projectPhases[0]!;

  const days = dayList.map((date) => {
    const dayEnd = new Date(date + 'T23:59:59.999Z');
    const counts: Record<string, number> = {};
    for (const p of projectPhases) counts[p.id] = 0;

    for (const t of projectTasks) {
      if (t.created_at > dayEnd) continue; // task didn't exist yet
      // If the task is terminal now but wasn't yet on this day, put it in the
      // first non-terminal phase as a rough approximation.
      const isTerminalNow =
        terminalPhase && t.phase_id === terminalPhase.id;
      const wasCompleted = t.completed_at && t.completed_at <= dayEnd;
      if (isTerminalNow && !wasCompleted) {
        counts[firstNonTerminal.id] = (counts[firstNonTerminal.id] ?? 0) + 1;
      } else if (t.phase_id && counts[t.phase_id] !== undefined) {
        counts[t.phase_id] = (counts[t.phase_id] ?? 0) + 1;
      }
    }
    return { date, counts };
  });

  return {
    phases: projectPhases.map((p) => ({
      id: p.id,
      name: p.name,
      order: p.position,
      color: p.color,
    })),
    days,
  };
}
