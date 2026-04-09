import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookEvents } from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineItem {
  id: string;
  source: string; // 'book', 'bam_task', 'bam_sprint', 'bearing_goal', 'bond_deal'
  title: string;
  start_at: string;
  end_at: string | null;
  color: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Get aggregated timeline
// ---------------------------------------------------------------------------

export async function getTimeline(
  orgId: string,
  startDate: string,
  endDate: string,
): Promise<{ data: TimelineItem[] }> {
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  const items: TimelineItem[] = [];

  // 1. Book events
  const events = await db
    .select()
    .from(bookEvents)
    .where(
      and(
        eq(bookEvents.organization_id, orgId),
        gte(bookEvents.end_at, rangeStart),
        lte(bookEvents.start_at, rangeEnd),
        sql`${bookEvents.status} != 'cancelled'`,
      ),
    )
    .orderBy(bookEvents.start_at);

  for (const event of events) {
    items.push({
      id: event.id,
      source: 'book',
      title: event.title,
      start_at: event.start_at.toISOString(),
      end_at: event.end_at.toISOString(),
      color: '#3b82f6',
    });
  }

  // Cross-product items (Bam tasks, sprints, Bearing goals, Bond deals)
  // would be fetched via internal API calls in a real implementation.
  // Placeholder: return Book events only for now.

  items.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return { data: items };
}
