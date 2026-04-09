import { eq, and, sql, desc, asc, isNull, isNotNull, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bondDeals,
  bondPipelines,
  bondPipelineStages,
  bondDealStageHistory,
} from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Pipeline Summary — value by stage, count, weighted value
// ---------------------------------------------------------------------------

export async function pipelineSummary(orgId: string, pipelineId?: string) {
  const conditions = [eq(bondDeals.organization_id, orgId)];
  if (pipelineId) {
    conditions.push(eq(bondDeals.pipeline_id, pipelineId));
  }
  // Only open deals
  conditions.push(isNull(bondDeals.closed_at));

  const rows = await db
    .select({
      stage_id: bondDeals.stage_id,
      stage_name: bondPipelineStages.name,
      stage_type: bondPipelineStages.stage_type,
      sort_order: bondPipelineStages.sort_order,
      color: bondPipelineStages.color,
      deal_count: sql<number>`count(*)::int`,
      total_value: sql<number>`COALESCE(sum(${bondDeals.value}), 0)::bigint`,
      weighted_value: sql<number>`COALESCE(sum(
        CASE WHEN ${bondDeals.value} IS NOT NULL AND ${bondDeals.probability_pct} IS NOT NULL
             THEN (${bondDeals.value} * ${bondDeals.probability_pct}) / 100
             ELSE 0 END
      ), 0)::bigint`,
    })
    .from(bondDeals)
    .innerJoin(bondPipelineStages, eq(bondDeals.stage_id, bondPipelineStages.id))
    .where(and(...conditions))
    .groupBy(
      bondDeals.stage_id,
      bondPipelineStages.name,
      bondPipelineStages.stage_type,
      bondPipelineStages.sort_order,
      bondPipelineStages.color,
    )
    .orderBy(asc(bondPipelineStages.sort_order));

  const totalDeals = rows.reduce((sum, r) => sum + r.deal_count, 0);
  const totalValue = rows.reduce((sum, r) => sum + Number(r.total_value), 0);
  const totalWeighted = rows.reduce((sum, r) => sum + Number(r.weighted_value), 0);

  return {
    stages: rows,
    totals: {
      deal_count: totalDeals,
      total_value: totalValue,
      weighted_value: totalWeighted,
    },
  };
}

// ---------------------------------------------------------------------------
// Stage Conversion Rates
// ---------------------------------------------------------------------------

export async function conversionRates(
  orgId: string,
  pipelineId: string,
  startDate?: string,
  endDate?: string,
) {
  const conditions = [
    sql`d.${bondDeals.organization_id} = ${orgId}`,
    sql`d.${bondDeals.pipeline_id} = ${pipelineId}`,
  ];

  if (startDate) {
    conditions.push(sql`h.${bondDealStageHistory.changed_at} >= ${startDate}::timestamptz`);
  }
  if (endDate) {
    conditions.push(sql`h.${bondDealStageHistory.changed_at} <= ${endDate}::timestamptz`);
  }

  // Get stages for ordering
  const stages = await db
    .select()
    .from(bondPipelineStages)
    .where(eq(bondPipelineStages.pipeline_id, pipelineId))
    .orderBy(asc(bondPipelineStages.sort_order));

  // Count transitions between stages
  const transitions = await db.execute(sql`
    SELECT
      h.from_stage_id,
      h.to_stage_id,
      count(*)::int as transition_count
    FROM bond_deal_stage_history h
    JOIN bond_deals d ON d.id = h.deal_id
    WHERE d.organization_id = ${orgId}
      AND d.pipeline_id = ${pipelineId}
      ${startDate ? sql`AND h.changed_at >= ${startDate}::timestamptz` : sql``}
      ${endDate ? sql`AND h.changed_at <= ${endDate}::timestamptz` : sql``}
      AND h.from_stage_id IS NOT NULL
    GROUP BY h.from_stage_id, h.to_stage_id
  `);

  // Build stage-to-stage conversion map
  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const conversions = (transitions.rows ?? transitions) as Array<{
    from_stage_id: string;
    to_stage_id: string;
    transition_count: number;
  }>;

  return {
    stages: stages.map((s) => ({ id: s.id, name: s.name, sort_order: s.sort_order })),
    conversions,
  };
}

// ---------------------------------------------------------------------------
// Deal Velocity — average time in each stage
// ---------------------------------------------------------------------------

export async function dealVelocity(orgId: string, pipelineId: string) {
  const result = await db.execute(sql`
    SELECT
      h.to_stage_id as stage_id,
      s.name as stage_name,
      s.sort_order,
      AVG(EXTRACT(EPOCH FROM h.duration_in_stage::interval))::numeric as avg_duration_seconds,
      count(*)::int as sample_count
    FROM bond_deal_stage_history h
    JOIN bond_deals d ON d.id = h.deal_id
    JOIN bond_pipeline_stages s ON s.id = h.from_stage_id
    WHERE d.organization_id = ${orgId}
      AND d.pipeline_id = ${pipelineId}
      AND h.duration_in_stage IS NOT NULL
      AND h.from_stage_id IS NOT NULL
    GROUP BY h.to_stage_id, s.name, s.sort_order
    ORDER BY s.sort_order
  `);

  const stages = (result.rows ?? result) as Array<{
    stage_id: string;
    stage_name: string;
    sort_order: number;
    avg_duration_seconds: number;
    sample_count: number;
  }>;

  // Average total cycle length (deals that are closed)
  const [cycleResult] = await db
    .select({
      avg_cycle_days: sql<number>`AVG(EXTRACT(EPOCH FROM (${bondDeals.closed_at} - ${bondDeals.created_at})) / 86400)::numeric`,
      sample_count: sql<number>`count(*)::int`,
    })
    .from(bondDeals)
    .where(
      and(
        eq(bondDeals.organization_id, orgId),
        eq(bondDeals.pipeline_id, pipelineId),
        isNotNull(bondDeals.closed_at),
      ),
    );

  return {
    stage_velocity: stages.map((s) => ({
      ...s,
      avg_duration_days: s.avg_duration_seconds
        ? Math.round((Number(s.avg_duration_seconds) / 86400) * 100) / 100
        : null,
    })),
    avg_cycle_days: cycleResult?.avg_cycle_days
      ? Math.round(Number(cycleResult.avg_cycle_days) * 100) / 100
      : null,
    closed_deal_count: cycleResult?.sample_count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Revenue Forecast
// ---------------------------------------------------------------------------

export async function forecast(orgId: string, pipelineId?: string) {
  const conditions = [
    eq(bondDeals.organization_id, orgId),
    isNull(bondDeals.closed_at),
  ];
  if (pipelineId) {
    conditions.push(eq(bondDeals.pipeline_id, pipelineId));
  }

  const now = new Date();
  const day30 = new Date(now.getTime() + 30 * 86400000);
  const day60 = new Date(now.getTime() + 60 * 86400000);
  const day90 = new Date(now.getTime() + 90 * 86400000);

  const deals = await db
    .select({
      value: bondDeals.value,
      probability_pct: bondDeals.probability_pct,
      expected_close_date: bondDeals.expected_close_date,
    })
    .from(bondDeals)
    .where(and(...conditions));

  const buckets = { next_30: 0, next_60: 0, next_90: 0, beyond: 0, no_date: 0 };
  let totalWeighted = 0;

  for (const deal of deals) {
    const weighted =
      deal.value && deal.probability_pct
        ? (deal.value * deal.probability_pct) / 100
        : 0;
    totalWeighted += weighted;

    if (!deal.expected_close_date) {
      buckets.no_date += weighted;
      continue;
    }

    const closeDate = new Date(deal.expected_close_date);
    if (closeDate <= day30) {
      buckets.next_30 += weighted;
    } else if (closeDate <= day60) {
      buckets.next_60 += weighted;
    } else if (closeDate <= day90) {
      buckets.next_90 += weighted;
    } else {
      buckets.beyond += weighted;
    }
  }

  return {
    total_weighted_value: totalWeighted,
    deal_count: deals.length,
    buckets,
  };
}

// ---------------------------------------------------------------------------
// Stale Deals
// ---------------------------------------------------------------------------

export async function staleDeals(orgId: string, pipelineId?: string) {
  const conditions = [
    eq(bondDeals.organization_id, orgId),
    isNull(bondDeals.closed_at),
  ];
  if (pipelineId) {
    conditions.push(eq(bondDeals.pipeline_id, pipelineId));
  }

  // Join deals with their stage to get rotting_days threshold
  const rows = await db
    .select({
      deal_id: bondDeals.id,
      deal_name: bondDeals.name,
      value: bondDeals.value,
      owner_id: bondDeals.owner_id,
      stage_id: bondDeals.stage_id,
      stage_name: bondPipelineStages.name,
      stage_entered_at: bondDeals.stage_entered_at,
      rotting_days: bondPipelineStages.rotting_days,
      last_activity_at: bondDeals.last_activity_at,
    })
    .from(bondDeals)
    .innerJoin(bondPipelineStages, eq(bondDeals.stage_id, bondPipelineStages.id))
    .where(and(...conditions));

  const now = new Date();
  const stale = rows
    .filter((row) => {
      if (!row.rotting_days) return false;
      const enteredAt = new Date(row.stage_entered_at);
      const daysInStage = (now.getTime() - enteredAt.getTime()) / 86400000;
      return daysInStage > row.rotting_days;
    })
    .map((row) => {
      const enteredAt = new Date(row.stage_entered_at);
      const daysInStage = Math.floor((now.getTime() - enteredAt.getTime()) / 86400000);
      return {
        deal_id: row.deal_id,
        deal_name: row.deal_name,
        value: row.value,
        owner_id: row.owner_id,
        stage_name: row.stage_name,
        days_in_stage: daysInStage,
        rotting_days_threshold: row.rotting_days,
        last_activity_at: row.last_activity_at,
      };
    })
    .sort((a, b) => b.days_in_stage - a.days_in_stage);

  return { stale_deals: stale, count: stale.length };
}

// ---------------------------------------------------------------------------
// Win/Loss Rate
// ---------------------------------------------------------------------------

export async function winLossRate(
  orgId: string,
  pipelineId?: string,
  startDate?: string,
  endDate?: string,
) {
  const conditions = [
    eq(bondDeals.organization_id, orgId),
    isNotNull(bondDeals.closed_at),
  ];
  if (pipelineId) {
    conditions.push(eq(bondDeals.pipeline_id, pipelineId));
  }
  if (startDate) {
    conditions.push(gte(bondDeals.closed_at, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(bondDeals.closed_at, new Date(endDate)));
  }

  const deals = await db
    .select({
      stage_id: bondDeals.stage_id,
      stage_type: bondPipelineStages.stage_type,
      value: bondDeals.value,
      close_reason: bondDeals.close_reason,
      lost_to_competitor: bondDeals.lost_to_competitor,
    })
    .from(bondDeals)
    .innerJoin(bondPipelineStages, eq(bondDeals.stage_id, bondPipelineStages.id))
    .where(and(...conditions));

  const won = deals.filter((d) => d.stage_type === 'won');
  const lost = deals.filter((d) => d.stage_type === 'lost');

  const totalClosed = won.length + lost.length;
  const winRate = totalClosed > 0 ? Math.round((won.length / totalClosed) * 10000) / 100 : 0;

  // Aggregate loss reasons
  const lossReasons: Record<string, number> = {};
  const competitors: Record<string, number> = {};
  for (const deal of lost) {
    const reason = deal.close_reason ?? 'Not specified';
    lossReasons[reason] = (lossReasons[reason] ?? 0) + 1;
    if (deal.lost_to_competitor) {
      competitors[deal.lost_to_competitor] = (competitors[deal.lost_to_competitor] ?? 0) + 1;
    }
  }

  return {
    total_closed: totalClosed,
    won_count: won.length,
    lost_count: lost.length,
    win_rate_pct: winRate,
    won_value: won.reduce((sum, d) => sum + (d.value ?? 0), 0),
    lost_value: lost.reduce((sum, d) => sum + (d.value ?? 0), 0),
    loss_reasons: Object.entries(lossReasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    competitors: Object.entries(competitors)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}
