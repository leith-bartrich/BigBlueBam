import { eq, and, gte, lte, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bookEvents,
  bookWorkingHours,
  bookExternalEvents,
} from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface WorkingHoursInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone?: string;
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Get available slots for a user
// ---------------------------------------------------------------------------

export async function getAvailability(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<AvailabilitySlot[]> {
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);

  // 1. Get working hours
  const workingHours = await db
    .select()
    .from(bookWorkingHours)
    .where(and(eq(bookWorkingHours.user_id, userId), eq(bookWorkingHours.enabled, true)));

  if (workingHours.length === 0) {
    return []; // No working hours configured
  }

  // 2. Get Book events where user is attendee or creator
  const events = await db
    .select({
      start_at: bookEvents.start_at,
      end_at: bookEvents.end_at,
      visibility: bookEvents.visibility,
    })
    .from(bookEvents)
    .where(
      and(
        gte(bookEvents.end_at, rangeStart),
        lte(bookEvents.start_at, rangeEnd),
        or(
          eq(bookEvents.created_by, userId),
          sql`${bookEvents.id} IN (SELECT event_id FROM book_event_attendees WHERE user_id = ${userId})`,
        ),
        sql`${bookEvents.status} != 'cancelled'`,
        sql`${bookEvents.visibility} != 'free'`,
      ),
    );

  // 3. Get external events
  const externalEvents = await db
    .select({
      start_at: bookExternalEvents.start_at,
      end_at: bookExternalEvents.end_at,
    })
    .from(bookExternalEvents)
    .where(
      and(
        eq(bookExternalEvents.user_id, userId),
        gte(bookExternalEvents.end_at, rangeStart),
        lte(bookExternalEvents.start_at, rangeEnd),
        eq(bookExternalEvents.visibility, 'busy'),
      ),
    );

  // 4. Build busy intervals
  const busyIntervals = [
    ...events.map((e) => ({ start: e.start_at, end: e.end_at })),
    ...externalEvents.map((e) => ({ start: e.start_at, end: e.end_at })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  // 5. Generate available slots from working hours minus busy intervals
  const slots: AvailabilitySlot[] = [];
  const current = new Date(rangeStart);

  while (current < rangeEnd) {
    const dayOfWeek = current.getDay(); // 0=Sunday
    const wh = workingHours.find((h) => h.day_of_week === dayOfWeek);

    if (wh) {
      const dayStr = current.toISOString().slice(0, 10);
      const whStart = new Date(`${dayStr}T${wh.start_time}Z`);
      const whEnd = new Date(`${dayStr}T${wh.end_time}Z`);

      // Subtract busy intervals
      let freeStart = whStart;
      for (const busy of busyIntervals) {
        if (busy.end <= freeStart) continue;
        if (busy.start >= whEnd) break;

        if (busy.start > freeStart) {
          slots.push({
            start: freeStart.toISOString(),
            end: (busy.start < whEnd ? busy.start : whEnd).toISOString(),
          });
        }
        freeStart = busy.end > freeStart ? busy.end : freeStart;
      }

      if (freeStart < whEnd) {
        slots.push({
          start: freeStart.toISOString(),
          end: whEnd.toISOString(),
        });
      }
    }

    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Get team availability (multiple users)
// ---------------------------------------------------------------------------

export async function getTeamAvailability(
  userIds: string[],
  startDate: string,
  endDate: string,
): Promise<Record<string, AvailabilitySlot[]>> {
  const result: Record<string, AvailabilitySlot[]> = {};

  for (const userId of userIds) {
    result[userId] = await getAvailability(userId, startDate, endDate);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Get working hours
// ---------------------------------------------------------------------------

export async function getWorkingHours(userId: string) {
  const rows = await db
    .select()
    .from(bookWorkingHours)
    .where(eq(bookWorkingHours.user_id, userId))
    .orderBy(bookWorkingHours.day_of_week);

  return { data: rows };
}

// ---------------------------------------------------------------------------
// Set working hours (full replacement)
// ---------------------------------------------------------------------------

export async function setWorkingHours(userId: string, hours: WorkingHoursInput[]) {
  // Delete existing
  await db.delete(bookWorkingHours).where(eq(bookWorkingHours.user_id, userId));

  if (hours.length === 0) {
    return { data: [] };
  }

  // Insert new
  const rows = await db
    .insert(bookWorkingHours)
    .values(
      hours.map((h) => ({
        user_id: userId,
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
        timezone: h.timezone ?? 'UTC',
        enabled: h.enabled ?? true,
      })),
    )
    .returning();

  return { data: rows };
}
