import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  blastCampaigns,
  blastUnsubscribes,
} from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Org-level overview metrics
// ---------------------------------------------------------------------------

export async function getOverviewMetrics(orgId: string) {
  // Total campaigns sent
  const [campaignStats] = await db
    .select({
      total_campaigns: sql<number>`count(*)::int`,
      total_sent: sql<number>`COALESCE(sum(total_sent), 0)::int`,
      total_delivered: sql<number>`COALESCE(sum(total_delivered), 0)::int`,
      total_opened: sql<number>`COALESCE(sum(total_opened), 0)::int`,
      total_clicked: sql<number>`COALESCE(sum(total_clicked), 0)::int`,
      total_bounced: sql<number>`COALESCE(sum(total_bounced), 0)::int`,
      total_unsubscribed: sql<number>`COALESCE(sum(total_unsubscribed), 0)::int`,
    })
    .from(blastCampaigns)
    .where(
      and(
        eq(blastCampaigns.organization_id, orgId),
        eq(blastCampaigns.status, 'sent'),
      ),
    );

  const stats = campaignStats ?? {
    total_campaigns: 0,
    total_sent: 0,
    total_delivered: 0,
    total_opened: 0,
    total_clicked: 0,
    total_bounced: 0,
    total_unsubscribed: 0,
  };

  const avgOpenRate = stats.total_sent > 0
    ? Math.round((stats.total_opened / stats.total_sent) * 10000) / 100
    : 0;
  const avgClickRate = stats.total_sent > 0
    ? Math.round((stats.total_clicked / stats.total_sent) * 10000) / 100
    : 0;
  const avgBounceRate = stats.total_sent > 0
    ? Math.round((stats.total_bounced / stats.total_sent) * 10000) / 100
    : 0;

  // Total unsubscribes
  const [unsubResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(blastUnsubscribes)
    .where(eq(blastUnsubscribes.organization_id, orgId));

  return {
    total_campaigns: stats.total_campaigns,
    total_sent: stats.total_sent,
    total_delivered: stats.total_delivered,
    total_opened: stats.total_opened,
    total_clicked: stats.total_clicked,
    total_bounced: stats.total_bounced,
    avg_open_rate: avgOpenRate,
    avg_click_rate: avgClickRate,
    avg_bounce_rate: avgBounceRate,
    total_unsubscribed: unsubResult?.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Engagement trend over time
// ---------------------------------------------------------------------------

export async function getEngagementTrend(orgId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
  const truncFn =
    period === 'monthly'
      ? sql`date_trunc('month', ${blastCampaigns.sent_at})`
      : period === 'weekly'
        ? sql`date_trunc('week', ${blastCampaigns.sent_at})`
        : sql`date_trunc('day', ${blastCampaigns.sent_at})`;

  const rows = await db
    .select({
      period: truncFn.as('period'),
      campaigns: sql<number>`count(*)::int`,
      total_sent: sql<number>`COALESCE(sum(total_sent), 0)::int`,
      total_opened: sql<number>`COALESCE(sum(total_opened), 0)::int`,
      total_clicked: sql<number>`COALESCE(sum(total_clicked), 0)::int`,
    })
    .from(blastCampaigns)
    .where(
      and(
        eq(blastCampaigns.organization_id, orgId),
        eq(blastCampaigns.status, 'sent'),
      ),
    )
    .groupBy(sql`period`)
    .orderBy(sql`period`);

  return rows.map((row) => ({
    period: row.period,
    campaigns: row.campaigns,
    total_sent: row.total_sent,
    total_opened: row.total_opened,
    total_clicked: row.total_clicked,
    open_rate: row.total_sent > 0
      ? Math.round((row.total_opened / row.total_sent) * 10000) / 100
      : 0,
    click_rate: row.total_sent > 0
      ? Math.round((row.total_clicked / row.total_sent) * 10000) / 100
      : 0,
  }));
}

// ---------------------------------------------------------------------------
// Check unsubscribe status
// ---------------------------------------------------------------------------

export async function checkUnsubscribed(orgId: string, email: string) {
  const [row] = await db
    .select()
    .from(blastUnsubscribes)
    .where(
      and(
        eq(blastUnsubscribes.organization_id, orgId),
        eq(blastUnsubscribes.email, email),
      ),
    )
    .limit(1);

  return {
    email,
    unsubscribed: !!row,
    unsubscribed_at: row?.unsubscribed_at ?? null,
    reason: row?.reason ?? null,
  };
}
