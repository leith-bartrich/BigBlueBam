import { eq, and, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { bookIcalTokens, bookEvents, bookCalendars } from '../db/schema/index.js';
import { notFound } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Generate iCal feed token
// ---------------------------------------------------------------------------

export async function generateIcalToken(calendarId: string, userId: string, orgId: string) {
  // BOOK-005: Verify calendar belongs to user's org before generating token
  const [calendar] = await db
    .select({ id: bookCalendars.id })
    .from(bookCalendars)
    .where(and(eq(bookCalendars.id, calendarId), eq(bookCalendars.organization_id, orgId)))
    .limit(1);

  if (!calendar) throw notFound('Calendar not found');

  const token = nanoid(48);

  const [row] = await db
    .insert(bookIcalTokens)
    .values({
      calendar_id: calendarId,
      user_id: userId,
      token,
    })
    .returning();

  return row!;
}

// ---------------------------------------------------------------------------
// Get iCal feed content
// ---------------------------------------------------------------------------

export async function getIcalFeed(token: string): Promise<string> {
  const [tokenRow] = await db
    .select()
    .from(bookIcalTokens)
    .where(eq(bookIcalTokens.token, token))
    .limit(1);

  if (!tokenRow) throw notFound('Invalid iCal feed token');

  const [calendar] = await db
    .select()
    .from(bookCalendars)
    .where(eq(bookCalendars.id, tokenRow.calendar_id))
    .limit(1);

  if (!calendar) throw notFound('Calendar not found');

  // Get events from the last 90 days to 365 days ahead
  const rangeStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const events = await db
    .select()
    .from(bookEvents)
    .where(
      and(
        eq(bookEvents.calendar_id, tokenRow.calendar_id),
        gte(bookEvents.end_at, rangeStart),
        lte(bookEvents.start_at, rangeEnd),
      ),
    );

  // Build iCal content
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//BigBlueBam//Book//EN`,
    `X-WR-CALNAME:${calendar.name}`,
    `X-WR-TIMEZONE:${calendar.timezone}`,
  ];

  for (const event of events) {
    const dtStart = formatIcalDate(event.start_at, event.all_day);
    const dtEnd = formatIcalDate(event.end_at, event.all_day);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@book.bigbluebam.com`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcal(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcal(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcal(event.location)}`);
    lines.push(`STATUS:${event.status.toUpperCase()}`);
    lines.push(`CREATED:${formatIcalDate(event.created_at, false)}`);
    lines.push(`LAST-MODIFIED:${formatIcalDate(event.updated_at, false)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function formatIcalDate(date: Date, allDay: boolean): string {
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcal(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
