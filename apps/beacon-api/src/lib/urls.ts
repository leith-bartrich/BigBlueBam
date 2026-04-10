// ---------------------------------------------------------------------------
// URL builders for deep-links into the Beacon SPA.
//
// Used by Bolt event payloads and anywhere else we need to hand a user
// (or an automation rule) a canonical link to a Beacon entry. The base
// URL comes from env.FRONTEND_URL (default `http://localhost/beacon`),
// matching the nginx mount point for the Beacon SPA.
// ---------------------------------------------------------------------------

import { env } from '../env.js';

function base(): string {
  return env.FRONTEND_URL.replace(/\/$/, '');
}

/**
 * Deep-link to a Beacon entry. Prefers slug (human-readable, stable across
 * edits) and falls back to UUID.
 */
export function beaconUrl(slugOrId: string): string {
  return `${base()}/${slugOrId}`;
}
