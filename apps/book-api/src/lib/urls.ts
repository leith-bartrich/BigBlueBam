// ---------------------------------------------------------------------------
// URL builders for deep-links into the Book SPA and public booking pages.
//
// Used by Bolt event payloads so downstream actions (Slack messages,
// emails, etc.) can include canonical links without each producer rebuilding
// them. Base URL comes from env.PUBLIC_URL and mirrors the nginx routing
// described in CLAUDE.md (`/book/` for the SPA, `/book/api/meet/:slug` for
// public booking pages).
// ---------------------------------------------------------------------------

import { env } from '../env.js';

function base(): string {
  return env.PUBLIC_URL.replace(/\/$/, '');
}

/** Deep-link to a specific event in the Book SPA. */
export function eventUrl(eventId: string): string {
  return `${base()}/book/events/${eventId}`;
}

/** Public booking page URL (what guests visit to book a slot). */
export function bookingPageUrl(slug: string): string {
  return `${base()}/book/api/meet/${slug}`;
}

/** Deep-link to a booking (shown to the booking-page owner). */
export function bookingUrl(eventId: string): string {
  return `${base()}/book/bookings/${eventId}`;
}
