import { eq, and, or, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookCalendars } from '../db/schema/index.js';
import { notFound, badRequest } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarFilters {
  organization_id: string;
  user_id: string;
  calendar_type?: string;
}

export interface CreateCalendarInput {
  name: string;
  description?: string;
  color?: string;
  calendar_type?: string;
  timezone?: string;
  project_id?: string;
}

export interface UpdateCalendarInput {
  name?: string;
  description?: string;
  color?: string;
  timezone?: string;
}

// ---------------------------------------------------------------------------
// List calendars
// ---------------------------------------------------------------------------

export async function listCalendars(filters: CalendarFilters) {
  const conditions = [
    eq(bookCalendars.organization_id, filters.organization_id),
    or(
      eq(bookCalendars.owner_user_id, filters.user_id),
      eq(bookCalendars.calendar_type, 'team'),
      eq(bookCalendars.calendar_type, 'project'),
    ),
  ];

  if (filters.calendar_type) {
    conditions.push(eq(bookCalendars.calendar_type, filters.calendar_type));
  }

  const rows = await db
    .select()
    .from(bookCalendars)
    .where(and(...conditions))
    .orderBy(desc(bookCalendars.created_at));

  return { data: rows };
}

// ---------------------------------------------------------------------------
// Get calendar
// ---------------------------------------------------------------------------

export async function getCalendar(id: string, orgId: string) {
  const [calendar] = await db
    .select()
    .from(bookCalendars)
    .where(and(eq(bookCalendars.id, id), eq(bookCalendars.organization_id, orgId)))
    .limit(1);

  if (!calendar) throw notFound('Calendar not found');
  return calendar;
}

// ---------------------------------------------------------------------------
// Create calendar
// ---------------------------------------------------------------------------

export async function createCalendar(
  input: CreateCalendarInput,
  orgId: string,
  userId: string,
) {
  const [calendar] = await db
    .insert(bookCalendars)
    .values({
      organization_id: orgId,
      owner_user_id: userId,
      name: input.name,
      description: input.description,
      color: input.color ?? '#3b82f6',
      calendar_type: input.calendar_type ?? 'personal',
      timezone: input.timezone ?? 'UTC',
      project_id: input.project_id,
    })
    .returning();

  return calendar!;
}

// ---------------------------------------------------------------------------
// Update calendar
// ---------------------------------------------------------------------------

export async function updateCalendar(id: string, orgId: string, input: UpdateCalendarInput) {
  await getCalendar(id, orgId);

  const [updated] = await db
    .update(bookCalendars)
    .set({
      ...input,
      updated_at: new Date(),
    })
    .where(and(eq(bookCalendars.id, id), eq(bookCalendars.organization_id, orgId)))
    .returning();

  if (!updated) throw notFound('Calendar not found');
  return updated;
}

// ---------------------------------------------------------------------------
// Delete calendar
// ---------------------------------------------------------------------------

export async function deleteCalendar(id: string, orgId: string) {
  const existing = await getCalendar(id, orgId);
  if (existing.is_default) {
    throw badRequest('Cannot delete default calendar');
  }

  const [deleted] = await db
    .delete(bookCalendars)
    .where(and(eq(bookCalendars.id, id), eq(bookCalendars.organization_id, orgId)))
    .returning({ id: bookCalendars.id });

  if (!deleted) throw notFound('Calendar not found');
  return deleted;
}
