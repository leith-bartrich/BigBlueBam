import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookEvents } from '../db/schema/index.js';
import { env } from '../env.js';

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
// Internal API helpers (best-effort, log and continue on failure)
// ---------------------------------------------------------------------------

async function fetchInternalJson(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
): Promise<unknown[]> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: unknown[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Get aggregated timeline
// ---------------------------------------------------------------------------

export async function getTimeline(
  orgId: string,
  startDate: string,
  endDate: string,
  sessionCookie?: string,
): Promise<{ data: TimelineItem[] }> {
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  const items: TimelineItem[] = [];

  // 1. Book events (local DB)
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

  // 2. Cross-product items via internal API calls
  const headers: Record<string, string> = {};
  if (sessionCookie) {
    headers['cookie'] = sessionCookie;
  }
  if (env.INTERNAL_SERVICE_SECRET) {
    headers['x-internal-secret'] = env.INTERNAL_SERVICE_SECRET;
  }

  const bamBaseUrl = env.BBB_API_INTERNAL_URL;

  // Fetch Bam tasks with due dates in range
  const tasksPromise = fetchInternalJson(
    bamBaseUrl,
    `/tasks?filter[due_date_after]=${startDate}&filter[due_date_before]=${endDate}&limit=100`,
    headers,
  );

  // Fetch Bond deals with expected close dates in range
  // Bond API internal URL is derived from the Bam API base.
  // If BOND_API_INTERNAL_URL is not set, try the conventional address.
  const bondBaseUrl = (env as Record<string, string>).BOND_API_INTERNAL_URL ?? 'http://bond-api:4009';
  const dealsPromise = fetchInternalJson(
    bondBaseUrl,
    `/v1/deals?expected_close_after=${startDate}&expected_close_before=${endDate}&limit=100`,
    headers,
  );

  const [rawTasks, rawDeals] = await Promise.all([tasksPromise, dealsPromise]);

  // Map Bam tasks to timeline items
  for (const raw of rawTasks) {
    const task = raw as Record<string, unknown>;
    const dueDate = task.due_date as string | undefined;
    if (!dueDate) continue;
    items.push({
      id: (task.id as string) ?? '',
      source: 'bam_task',
      title: (task.title as string) ?? 'Untitled task',
      start_at: dueDate,
      end_at: null,
      color: '#f59e0b', // amber
      metadata: { human_id: task.human_id, priority: task.priority },
    });
  }

  // Map Bond deals to timeline items
  for (const raw of rawDeals) {
    const deal = raw as Record<string, unknown>;
    const closeDate = deal.expected_close_date as string | undefined;
    if (!closeDate) continue;
    items.push({
      id: (deal.id as string) ?? '',
      source: 'bond_deal',
      title: (deal.name as string) ?? 'Untitled deal',
      start_at: closeDate,
      end_at: null,
      color: '#10b981', // emerald
      metadata: { value: deal.value, currency: deal.currency },
    });
  }

  items.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return { data: items };
}
