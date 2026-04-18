import { eq, and, gte, lte, or, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bookEvents,
  bookWorkingHours,
  bookExternalEvents,
} from '../db/schema/index.js';
import { users } from '../db/schema/bbb-refs.js';

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
// §18 Wave 5 misc: mixed-roster meeting-time finder
// ---------------------------------------------------------------------------
//
// Like getTeamAvailability+intersect, but treats agents/service accounts as
// unconditionally available (no calendar, no working hours) when the caller
// asks us to respect working hours for humans only. Returns slots that are
// long enough for the requested duration along with per-attendee availability
// flags so the caller can render "available: agent always" next to the human
// conflict markers.

export type ActorKind = 'human' | 'agent' | 'service';

export interface MixedAttendee {
  user_id: string;
  kind: ActorKind;
  available: boolean;
}

export interface MixedMeetingSlot {
  start: string;
  end: string;
  attendees: MixedAttendee[];
}

export interface FindMeetingTimeForMixedRosterParams {
  user_ids: string[];
  duration_minutes: number;
  window: { since: string; until: string };
  respect_working_hours_for_humans_only?: boolean;
  timezone?: string;
}

/**
 * Resolve the kinds of a set of user ids. Unknown users default to 'human'
 * so the scheduler errs on the side of running the normal conflict check.
 * Callers are expected to have already org-scoped the list; this query does
 * not repeat that check.
 */
export async function resolveUserKinds(
  userIds: string[],
): Promise<Map<string, ActorKind>> {
  const map = new Map<string, ActorKind>();
  if (userIds.length === 0) return map;
  const rows = await db
    .select({ id: users.id, kind: users.kind })
    .from(users)
    .where(inArray(users.id, userIds));
  for (const row of rows) {
    const k = row.kind;
    if (k === 'human' || k === 'agent' || k === 'service') {
      map.set(row.id, k);
    } else {
      map.set(row.id, 'human');
    }
  }
  // Fill in any missing ids with the safe default.
  for (const id of userIds) {
    if (!map.has(id)) map.set(id, 'human');
  }
  return map;
}

/**
 * Find candidate meeting slots across a mixed roster of humans and agents.
 * When `respect_working_hours_for_humans_only` is true (default), agents and
 * service accounts are treated as always available across the window and are
 * skipped from the intersection. If the roster has no humans, the full
 * window is a single candidate (capped at duration boundaries by the caller).
 * The return shape matches the AGENTIC_TODO §18 Wave 5 spec:
 *   slots: [{ start, end, attendees: [{ user_id, kind, available }] }]
 */
export async function findMeetingTimeForMixedRoster(
  params: FindMeetingTimeForMixedRosterParams,
): Promise<{ slots: MixedMeetingSlot[] }> {
  const respectHumansOnly = params.respect_working_hours_for_humans_only ?? true;
  const durationMs = params.duration_minutes * 60 * 1000;

  const kinds = await resolveUserKinds(params.user_ids);

  // Partition. When the caller sets respect_working_hours_for_humans_only=false
  // we treat every id like a human and put them all through the conflict
  // machinery. Otherwise only humans get the real availability pull.
  const humanIds: string[] = [];
  const agentIds: string[] = [];
  for (const id of params.user_ids) {
    const k = kinds.get(id) ?? 'human';
    if (!respectHumansOnly) {
      humanIds.push(id);
    } else if (k === 'agent' || k === 'service') {
      agentIds.push(id);
    } else {
      humanIds.push(id);
    }
  }

  const attendeesFor = (kindOverride?: Map<string, ActorKind>): MixedAttendee[] =>
    params.user_ids.map((id) => {
      const k = (kindOverride ?? kinds).get(id) ?? 'human';
      // Agents and service accounts report available: true in every slot we
      // ever emit; humans are only emitted on slots where they have free time,
      // so their `available` is also true by construction.
      return { user_id: id, kind: k, available: true };
    });

  // No humans to schedule against: the full window is a single slot. The
  // caller still receives the attendee list so they can render the roster.
  if (humanIds.length === 0) {
    const startMs = new Date(params.window.since).getTime();
    const endMs = new Date(params.window.until).getTime();
    if (endMs - startMs < durationMs) {
      return { slots: [] };
    }
    return {
      slots: [
        {
          start: params.window.since,
          end: params.window.until,
          attendees: attendeesFor(),
        },
      ],
    };
  }

  // Pull availability for the human portion and intersect. We reuse the
  // existing per-user availability builder which already honors working
  // hours, busy events, and external events.
  const perUser = await Promise.all(
    humanIds.map(async (id) => ({
      id,
      slots: await getAvailability(id, params.window.since, params.window.until),
    })),
  );

  if (perUser.length === 0) return { slots: [] };

  let common: AvailabilitySlot[] = perUser[0]!.slots;
  for (let i = 1; i < perUser.length; i++) {
    common = intersectAvailabilitySlots(common, perUser[i]!.slots);
  }

  // Keep slots long enough for the meeting. Agents/service accounts are
  // implicit in the attendee list even though they didn't contribute a busy
  // constraint; the caller needs them listed so rendering works.
  const attendees = attendeesFor();
  const _agentCount = agentIds.length; // touched for readability / future rate-limit hooks
  void _agentCount;
  const candidates: MixedMeetingSlot[] = common
    .filter((s) => new Date(s.end).getTime() - new Date(s.start).getTime() >= durationMs)
    .map((s) => ({
      start: s.start,
      end: new Date(new Date(s.start).getTime() + durationMs).toISOString(),
      attendees,
    }));

  return { slots: candidates };
}

/**
 * Intersect two sorted lists of availability slots. Both inputs come out of
 * getAvailability() already sorted by start time. Duplicated locally from the
 * MCP book-tools helper so the book-api service has no MCP-layer dependency.
 */
function intersectAvailabilitySlots(
  a: AvailabilitySlot[],
  b: AvailabilitySlot[],
): AvailabilitySlot[] {
  const out: AvailabilitySlot[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const aStart = new Date(a[i]!.start).getTime();
    const aEnd = new Date(a[i]!.end).getTime();
    const bStart = new Date(b[j]!.start).getTime();
    const bEnd = new Date(b[j]!.end).getTime();
    const overlapStart = Math.max(aStart, bStart);
    const overlapEnd = Math.min(aEnd, bEnd);
    if (overlapStart < overlapEnd) {
      out.push({
        start: new Date(overlapStart).toISOString(),
        end: new Date(overlapEnd).toISOString(),
      });
    }
    if (aEnd < bEnd) i++;
    else j++;
  }
  return out;
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
