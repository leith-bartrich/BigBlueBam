// ---------------------------------------------------------------------------
// Bolt event payload enrichment helpers for Book
//
// Phase B / Tier 1 of docs/bolt-id-mapping-strategy.md: every Bolt event
// payload Book emits must include, for every entity referenced:
//   - all relevant IDs (so downstream actions can chain without lookups)
//   - canonical names / emails (event.title, calendar.name, organizer info)
//   - deep-link URLs
//   - the full `actor` object
//   - the full `org` context
//
// These helpers are fire-and-forget friendly: each one tolerates missing data
// and returns a plain object that the caller spreads into the Bolt payload.
// ---------------------------------------------------------------------------

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookEvents, bookCalendars, bookEventAttendees, bookBookingPages } from '../db/schema/index.js';
import { users, organizations } from '../db/schema/bbb-refs.js';
import { eventUrl, bookingPageUrl, bookingUrl } from './urls.js';

// ---------------------------------------------------------------------------
// Actor / org context
// ---------------------------------------------------------------------------

export interface ActorContext {
  id: string;
  name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface OrgContext {
  id: string;
  name: string | null;
  slug: string | null;
}

export async function loadActor(actorId: string | null | undefined): Promise<ActorContext | null> {
  if (!actorId) return null;
  const [row] = await db
    .select({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
      avatar_url: users.avatar_url,
    })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.display_name,
    display_name: row.display_name,
    email: row.email,
    avatar_url: row.avatar_url,
  };
}

export async function loadOrg(orgId: string): Promise<OrgContext | null> {
  const [row] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Event enrichment
// ---------------------------------------------------------------------------

export interface EnrichedEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  conference_url: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  all_day: boolean;
  url: string;
  calendar_id: string;
  calendar_name: string | null;
  organizer_id: string | null;
  organizer_name: string | null;
  organizer_email: string | null;
  attendees: Array<{
    user_id: string | null;
    email: string;
    name: string | null;
    is_organizer: boolean;
    response_status: string;
  }>;
  attendee_count: number;
}

/**
 * Load an event row plus its calendar, organizer, and attendees and shape
 * it for a Bolt event payload.
 */
export async function enrichEvent(eventId: string): Promise<EnrichedEvent | null> {
  const [row] = await db
    .select()
    .from(bookEvents)
    .where(eq(bookEvents.id, eventId))
    .limit(1);
  if (!row) return null;

  const [calendar] = row.calendar_id
    ? await db
        .select({ id: bookCalendars.id, name: bookCalendars.name })
        .from(bookCalendars)
        .where(eq(bookCalendars.id, row.calendar_id))
        .limit(1)
    : [];

  const [organizer] = row.created_by
    ? await db
        .select({
          id: users.id,
          display_name: users.display_name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, row.created_by))
        .limit(1)
    : [];

  const attendees = await db
    .select({
      user_id: bookEventAttendees.user_id,
      email: bookEventAttendees.email,
      name: bookEventAttendees.name,
      is_organizer: bookEventAttendees.is_organizer,
      response_status: bookEventAttendees.response_status,
    })
    .from(bookEventAttendees)
    .where(eq(bookEventAttendees.event_id, eventId));

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    location: row.location ?? null,
    conference_url: row.meeting_url ?? null,
    start_time: row.start_at instanceof Date ? row.start_at.toISOString() : String(row.start_at),
    end_time: row.end_at instanceof Date ? row.end_at.toISOString() : String(row.end_at),
    timezone: row.timezone,
    status: row.status,
    all_day: row.all_day,
    url: eventUrl(row.id),
    calendar_id: row.calendar_id,
    calendar_name: calendar?.name ?? null,
    organizer_id: organizer?.id ?? null,
    organizer_name: organizer?.display_name ?? null,
    organizer_email: organizer?.email ?? null,
    attendees: attendees.map((a) => ({
      user_id: a.user_id ?? null,
      email: a.email,
      name: a.name ?? null,
      is_organizer: a.is_organizer,
      response_status: a.response_status,
    })),
    attendee_count: attendees.length,
  };
}

// ---------------------------------------------------------------------------
// Booking enrichment (for booking.created)
// ---------------------------------------------------------------------------

export interface EnrichedBooking {
  id: string;
  event_id: string;
  booking_page_id: string;
  title: string;
  start_time: string;
  end_time: string;
  timezone: string;
  duration_minutes: number;
  guest_name: string | null;
  guest_email: string | null;
  host_id: string | null;
  host_name: string | null;
  host_email: string | null;
  url: string;
}

export interface EnrichedBookingPage {
  id: string;
  name: string;
  slug: string;
  url: string;
}

/** Enrich a booking (which is itself a book_events row with booking_page_id set). */
export async function enrichBooking(eventId: string): Promise<{
  booking: EnrichedBooking;
  booking_page: EnrichedBookingPage | null;
} | null> {
  const [row] = await db
    .select()
    .from(bookEvents)
    .where(eq(bookEvents.id, eventId))
    .limit(1);
  if (!row) return null;

  const pageId = row.booking_page_id;
  let page:
    | {
        id: string;
        title: string;
        slug: string;
        duration_minutes: number;
        owner_user_id: string;
      }
    | undefined;
  if (pageId) {
    const [p] = await db
      .select({
        id: bookBookingPages.id,
        title: bookBookingPages.title,
        slug: bookBookingPages.slug,
        duration_minutes: bookBookingPages.duration_minutes,
        owner_user_id: bookBookingPages.owner_user_id,
      })
      .from(bookBookingPages)
      .where(eq(bookBookingPages.id, pageId))
      .limit(1);
    page = p;
  }

  const [host] = page?.owner_user_id
    ? await db
        .select({
          id: users.id,
          display_name: users.display_name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, page.owner_user_id))
        .limit(1)
    : [];

  const start = row.start_at instanceof Date ? row.start_at : new Date(row.start_at as unknown as string);
  const end = row.end_at instanceof Date ? row.end_at : new Date(row.end_at as unknown as string);
  const durationMinutes =
    page?.duration_minutes ?? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

  return {
    booking: {
      id: row.id,
      event_id: row.id,
      booking_page_id: pageId ?? '',
      title: row.title,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      timezone: row.timezone,
      duration_minutes: durationMinutes,
      guest_name: row.booked_by_name ?? null,
      guest_email: row.booked_by_email ?? null,
      host_id: host?.id ?? page?.owner_user_id ?? null,
      host_name: host?.display_name ?? null,
      host_email: host?.email ?? null,
      url: bookingUrl(row.id),
    },
    booking_page: page
      ? {
          id: page.id,
          name: page.title,
          slug: page.slug,
          url: bookingPageUrl(page.slug),
        }
      : null,
  };
}
