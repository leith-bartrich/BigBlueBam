/**
 * Tenant context store (D-010).
 *
 * Parses the URL path `/helpdesk/<orgSlug>/<projectSlug>/<rest>` on load
 * and exposes `{ orgSlug, projectSlug, orgName, projectName }` to the rest
 * of the SPA. The lib/api.ts fetch wrapper reads `orgSlug` and
 * `projectSlug` from here and injects them as X-Org-Slug / X-Project-Slug
 * headers on every request.
 */
import { create } from 'zustand';

interface TenantState {
  orgSlug: string | null;
  projectSlug: string | null;
  orgName: string | null;
  projectName: string | null;
  /**
   * Parsed from the URL once at app boot. Updated by setBranding() when
   * the SPA fetches /helpdesk/public/orgs/:slug and learns the org / project
   * display names.
   */
  setSlugs: (orgSlug: string | null, projectSlug: string | null) => void;
  setBranding: (orgName: string | null, projectName: string | null) => void;
  reset: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  orgSlug: null,
  projectSlug: null,
  orgName: null,
  projectName: null,
  setSlugs: (orgSlug, projectSlug) => set({ orgSlug, projectSlug }),
  setBranding: (orgName, projectName) => set({ orgName, projectName }),
  reset: () =>
    set({ orgSlug: null, projectSlug: null, orgName: null, projectName: null }),
}));

/** Snapshot getter usable from non-React code (e.g. the api client). */
export function getTenantSnapshot(): {
  orgSlug: string | null;
  projectSlug: string | null;
} {
  const state = useTenantStore.getState();
  return { orgSlug: state.orgSlug, projectSlug: state.projectSlug };
}

/**
 * Parse `/helpdesk/<orgSlug>/<projectSlug>/...` out of a pathname. Returns
 * { orgSlug: null, projectSlug: null } for `/helpdesk/` and `/helpdesk`.
 *
 * Reserved first-segment paths that are SPA routes rather than org slugs:
 *   login, register, verify, tickets
 * These always resolve to { orgSlug: null, projectSlug: null } so that
 * legacy deep-links (`/helpdesk/tickets/42`) continue to work during the
 * rollout. Once every deployment has migrated customers to org-scoped
 * URLs, the reserved list can be pruned; for now it preserves backward
 * compatibility with bookmarks the existing test data set emits.
 */
const RESERVED_FIRST_SEGMENTS = new Set([
  'login',
  'register',
  'verify',
  'tickets',
]);

export function parseTenantFromPath(pathname: string): {
  orgSlug: string | null;
  projectSlug: string | null;
} {
  const BASE = '/helpdesk';
  let p = pathname;
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  // Trim trailing slash for easier splitting.
  if (p.startsWith('/')) p = p.slice(1);
  if (!p) return { orgSlug: null, projectSlug: null };
  const parts = p.split('/').filter(Boolean);
  if (parts.length === 0) return { orgSlug: null, projectSlug: null };

  const first = parts[0]!;
  if (RESERVED_FIRST_SEGMENTS.has(first)) {
    return { orgSlug: null, projectSlug: null };
  }

  // First segment is an org slug. Second segment is a project slug only
  // when it is not itself reserved (so that
  // `/helpdesk/<orgSlug>/tickets/42` keeps tickets/42 as an SPA sub-route
  // rather than interpreting `tickets` as a project slug).
  const orgSlug = first;
  const second = parts[1];
  if (second && !RESERVED_FIRST_SEGMENTS.has(second)) {
    return { orgSlug, projectSlug: second };
  }
  return { orgSlug, projectSlug: null };
}
