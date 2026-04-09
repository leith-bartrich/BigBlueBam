import { eq, and, or, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bearingPeriods,
  bearingGoals,
  bearingKeyResults,
} from '../db/schema/index.js';
import { BearingError } from './period.service.js';

/** Group key results by goal_id for batch-loaded results */
function groupKrsByGoal(krs: Array<{ goal_id: string; [key: string]: unknown }>) {
  const map = new Map<string, typeof krs>();
  for (const kr of krs) {
    const list = map.get(kr.goal_id) ?? [];
    list.push(kr);
    map.set(kr.goal_id, list);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Generate a full period report in Markdown format.
 */
export async function generatePeriodReport(periodId: string, orgId: string) {
  const [period] = await db
    .select()
    .from(bearingPeriods)
    .where(and(eq(bearingPeriods.id, periodId), eq(bearingPeriods.organization_id, orgId)))
    .limit(1);

  if (!period) throw new BearingError('NOT_FOUND', 'Period not found', 404);

  const goals = await db
    .select()
    .from(bearingGoals)
    .where(and(eq(bearingGoals.period_id, periodId), eq(bearingGoals.organization_id, orgId)))
    .limit(500);

  let markdown = `# ${period.name} Report\n\n`;
  markdown += `**Type:** ${period.period_type}  \n`;
  markdown += `**Period:** ${period.starts_at} to ${period.ends_at}  \n`;
  markdown += `**Status:** ${period.status}  \n\n`;

  // Summary stats
  const totalGoals = goals.length;
  const achievedGoals = goals.filter((g) => g.status === 'achieved').length;
  const atRiskGoals = goals.filter((g) => g.status === 'at_risk' || g.status === 'behind').length;
  const avgProgress =
    totalGoals > 0
      ? goals.reduce((sum, g) => sum + parseFloat(g.progress), 0) / totalGoals
      : 0;

  markdown += `## Summary\n\n`;
  markdown += `| Metric | Value |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Goals | ${totalGoals} |\n`;
  markdown += `| Achieved | ${achievedGoals} |\n`;
  markdown += `| At Risk / Behind | ${atRiskGoals} |\n`;
  markdown += `| Average Progress | ${avgProgress.toFixed(1)}% |\n\n`;

  // Batch-load all key results for the goals in a single query
  const goalIds = goals.map((g) => g.id);
  const allKrs = goalIds.length > 0
    ? await db.select().from(bearingKeyResults).where(inArray(bearingKeyResults.goal_id, goalIds))
    : [];
  const krsByGoal = groupKrsByGoal(allKrs as any);

  // Goals detail
  markdown += `## Goals\n\n`;
  for (const goal of goals) {
    markdown += `### ${goal.title}\n\n`;
    markdown += `- **Status:** ${goal.status}\n`;
    markdown += `- **Progress:** ${goal.progress}%\n`;
    markdown += `- **Scope:** ${goal.scope}\n`;
    if (goal.description) {
      markdown += `- **Description:** ${goal.description}\n`;
    }

    const krs = (krsByGoal.get(goal.id) ?? []) as any[];

    if (krs.length > 0) {
      markdown += `\n**Key Results:**\n\n`;
      for (const kr of krs) {
        markdown += `- ${kr.title}: ${kr.current_value}/${kr.target_value} ${kr.unit ?? ''} (${kr.progress}%)\n`;
      }
    }
    markdown += `\n`;
  }

  return {
    format: 'markdown',
    content: markdown,
    generated_at: new Date().toISOString(),
    period_id: periodId,
  };
}

/**
 * Generate an at-risk goals report.
 */
export async function generateAtRiskReport(orgId: string) {
  const goals = await db
    .select()
    .from(bearingGoals)
    .where(
      and(
        eq(bearingGoals.organization_id, orgId),
        or(
          eq(bearingGoals.status, 'at_risk'),
          eq(bearingGoals.status, 'behind'),
        ),
      ),
    )
    .limit(500);

  let markdown = `# At-Risk Goals Report\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}  \n`;
  markdown += `**Total at-risk goals:** ${goals.length}  \n\n`;

  if (goals.length === 0) {
    markdown += `No goals are currently at risk. Great work!\n`;
  } else {
    // Batch-load all key results for at-risk goals
    const atRiskGoalIds = goals.map((g) => g.id);
    const allAtRiskKrs = atRiskGoalIds.length > 0
      ? await db.select().from(bearingKeyResults).where(inArray(bearingKeyResults.goal_id, atRiskGoalIds))
      : [];
    const atRiskKrsByGoal = groupKrsByGoal(allAtRiskKrs as any);

    for (const goal of goals) {
      markdown += `### ${goal.title}\n\n`;
      markdown += `- **Status:** ${goal.status}\n`;
      markdown += `- **Progress:** ${goal.progress}%\n`;
      markdown += `- **Period:** ${goal.period_id}\n`;
      if (goal.description) {
        markdown += `- **Description:** ${goal.description}\n`;
      }

      const krs = (atRiskKrsByGoal.get(goal.id) ?? []) as any[];

      if (krs.length > 0) {
        markdown += `\n**Key Results:**\n\n`;
        for (const kr of krs) {
          const behindMarker = parseFloat(kr.progress) < 50 ? ' :warning:' : '';
          markdown += `- ${kr.title}: ${kr.progress}%${behindMarker}\n`;
        }
      }
      markdown += `\n`;
    }
  }

  return {
    format: 'markdown',
    content: markdown,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Generate a report for a specific user's goals across periods.
 */
export async function generateOwnerReport(userId: string, orgId: string) {
  const goals = await db
    .select()
    .from(bearingGoals)
    .where(
      and(
        eq(bearingGoals.organization_id, orgId),
        eq(bearingGoals.owner_id, userId),
      ),
    )
    .limit(500);

  let markdown = `# Goals Report for Owner\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}  \n`;
  markdown += `**Total goals:** ${goals.length}  \n\n`;

  // Batch-load all key results and periods for owner goals
  const ownerGoalIds = goals.map((g) => g.id);
  const allOwnerKrs = ownerGoalIds.length > 0
    ? await db.select().from(bearingKeyResults).where(inArray(bearingKeyResults.goal_id, ownerGoalIds))
    : [];
  const ownerKrsByGoal = groupKrsByGoal(allOwnerKrs as any);

  // Group by period
  const byPeriod = new Map<string, typeof goals>();
  for (const goal of goals) {
    const periodGoals = byPeriod.get(goal.period_id) ?? [];
    periodGoals.push(goal);
    byPeriod.set(goal.period_id, periodGoals);
  }

  // Batch-load all referenced periods
  const periodIds = [...byPeriod.keys()];
  const allPeriods = periodIds.length > 0
    ? await db.select().from(bearingPeriods).where(inArray(bearingPeriods.id, periodIds))
    : [];
  const periodMap = new Map(allPeriods.map((p) => [p.id, p]));

  for (const [periodId, periodGoals] of byPeriod) {
    const period = periodMap.get(periodId);

    markdown += `## ${period?.name ?? periodId}\n\n`;

    for (const goal of periodGoals) {
      markdown += `### ${goal.title}\n\n`;
      markdown += `- **Status:** ${goal.status}\n`;
      markdown += `- **Progress:** ${goal.progress}%\n`;

      const krs = (ownerKrsByGoal.get(goal.id) ?? []) as any[];

      if (krs.length > 0) {
        markdown += `\n**Key Results:**\n\n`;
        for (const kr of krs) {
          markdown += `- ${kr.title}: ${kr.current_value}/${kr.target_value} ${kr.unit ?? ''} (${kr.progress}%)\n`;
        }
      }
      markdown += `\n`;
    }
  }

  return {
    format: 'markdown',
    content: markdown,
    generated_at: new Date().toISOString(),
    owner_id: userId,
  };
}
