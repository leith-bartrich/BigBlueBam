/**
 * Shared resolver helpers for MCP tools that need to accept either a UUID or
 * a slug for parameters like Beacon `id` or Brief `document_id`.
 *
 * Rationale
 * ---------
 * Read tools (beacon_get, brief_get) have always accepted either a UUID or a
 * slug because the underlying `GET /beacons/:id` / `GET /documents/:id` routes
 * dispatch on format in their middleware. Write tools historically required
 * UUIDs, which makes rule authors stumble: they pull a slug out of
 * `beacon_search` or a prior `beacon_get` and feed it straight into
 * `beacon_update`, only to get a validation error.
 *
 * These helpers close the gap. Each tool that takes an id/slug parameter
 * should (1) relax its Zod schema to a plain `z.string()` and (2) run the
 * input through `resolveBeaconId` / `resolveDocumentId` before handing the
 * value to the write endpoint.
 *
 * If the input is already a UUID we return it unchanged — no extra HTTP call.
 * Otherwise we hit the dedicated `/by-slug/:slug` resolver endpoint, which is
 * auth-gated identically to the normal read endpoint, so authorization cannot
 * be bypassed by slug-smuggling.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/**
 * Minimal shape we expect from the per-service REST client wrappers used by
 * beacon-tools.ts and brief-tools.ts. We keep it structural so the helpers
 * stay reusable without dragging in a concrete class dependency.
 */
export interface SlugResolverClient {
  request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; data: unknown }>;
}

/**
 * Resolve a Beacon identifier that may be either a UUID or a slug to a UUID.
 *
 * Returns the UUID on success, or `null` if the slug does not resolve to a
 * beacon visible to the current caller. Callers should surface a clean
 * "Beacon not found" error when they get `null` back.
 */
export async function resolveBeaconId(
  client: SlugResolverClient,
  idOrSlug: string,
): Promise<string | null> {
  if (isUuid(idOrSlug)) return idOrSlug;
  const result = await client.request('GET', `/beacons/by-slug/${encodeURIComponent(idOrSlug)}`);
  if (!result.ok) return null;
  const envelope = result.data as { data?: { id?: string } } | null;
  return envelope?.data?.id ?? null;
}

/**
 * Resolve a Brief document identifier that may be either a UUID or a slug
 * to a UUID. Same contract as `resolveBeaconId` — `null` on miss.
 */
export async function resolveDocumentId(
  client: SlugResolverClient,
  idOrSlug: string,
): Promise<string | null> {
  if (isUuid(idOrSlug)) return idOrSlug;
  const result = await client.request('GET', `/documents/by-slug/${encodeURIComponent(idOrSlug)}`);
  if (!result.ok) return null;
  const envelope = result.data as { data?: { id?: string } } | null;
  return envelope?.data?.id ?? null;
}
