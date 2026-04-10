/**
 * Shared resolver helpers for MCP tools that need to accept either a UUID, a
 * slug, or a human-readable title/name/ref for parameters like Beacon `id`,
 * Brief `document_id`, Bam `task_id`, or Bam `project_id`.
 *
 * Rationale
 * ---------
 * Read tools (beacon_get, brief_get) have always accepted either a UUID or a
 * slug because the underlying `GET /beacons/:id` / `GET /documents/:id` routes
 * dispatch on format in their middleware. Write tools historically required
 * UUIDs, which makes rule authors stumble: they pull a slug out of
 * `beacon_search` or a prior `beacon_get` and feed it straight into
 * `beacon_update`, only to get a validation error. Phase D extends that a
 * step further — LLMs often know documents by their *title* (`Q2 Release
 * Notes`), projects by their *name* (`Mage Inc`), and tasks by their *human
 * ref* (`FRND-42`) rather than the underlying IDs.
 *
 * These helpers close the gap. Each tool that takes an id parameter should
 * (1) relax its Zod schema to a plain `z.string()` and (2) run the input
 * through the matching `resolve*` helper before handing the value to the
 * write endpoint.
 *
 * If the input is already a UUID we return it unchanged — no extra HTTP call.
 * Otherwise we hit a narrow lookup path (`/by-slug/:slug`, a search endpoint,
 * or the projects list) that is auth-gated identically to the normal read
 * endpoint, so authorization cannot be bypassed by name-smuggling.
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
 * Resolve a Beacon identifier that may be either a UUID, a slug, or a title
 * to a UUID.
 *
 * Resolution order:
 *   1. If the input is a UUID, return it unchanged (no HTTP calls).
 *   2. Try the `/beacons/by-slug/:slug` resolver — slugs are URL-safe and
 *      low-cardinality, so this is the common case for Phase C callers.
 *   3. Fall back to a title search via `/beacons?search=...&limit=2`. An
 *      exact case-insensitive title match wins; otherwise, if exactly one
 *      beacon is returned we treat it as the match (the search endpoint
 *      does prefix/ILIKE matching on both title and summary, so a single
 *      hit is unambiguous enough to act on). Ambiguous results return
 *      `null` so the caller can surface a clean "Beacon not found".
 *
 * Returns the UUID on success, or `null` if the input does not resolve to a
 * beacon visible to the current caller. Callers should surface a clean
 * "Beacon not found" error when they get `null` back.
 */
export async function resolveBeaconId(
  client: SlugResolverClient,
  idOrSlugOrTitle: string,
): Promise<string | null> {
  if (isUuid(idOrSlugOrTitle)) return idOrSlugOrTitle;
  // Try slug first — Phase C behavior.
  const slugResult = await client.request(
    'GET',
    `/beacons/by-slug/${encodeURIComponent(idOrSlugOrTitle)}`,
  );
  if (slugResult.ok) {
    const envelope = slugResult.data as { data?: { id?: string } } | null;
    const id = envelope?.data?.id;
    if (id) return id;
  }
  // Fallback: title search via the list endpoint.
  return resolveBeaconIdByTitle(client, idOrSlugOrTitle);
}

/**
 * Title-based fallback for {@link resolveBeaconId}. Exported for tests and
 * for callers that want to *force* a title search (skipping the slug probe).
 *
 * Strategy: list two results matching the query, prefer an exact
 * case-insensitive title match, otherwise accept a lone result. Anything
 * ambiguous returns `null`.
 */
export async function resolveBeaconIdByTitle(
  client: SlugResolverClient,
  query: string,
): Promise<string | null> {
  const result = await client.request(
    'GET',
    `/beacons?search=${encodeURIComponent(query)}&limit=2`,
  );
  if (!result.ok) return null;
  const envelope = result.data as {
    data?: Array<{ id: string; title: string }>;
  } | null;
  const beacons = envelope?.data ?? [];
  if (beacons.length === 0) return null;
  const needle = query.toLowerCase();
  const exact = beacons.find((b) => b.title.toLowerCase() === needle);
  if (exact) return exact.id;
  if (beacons.length === 1) return beacons[0]!.id;
  return null;
}

/**
 * Resolve a Brief document identifier that may be a UUID, a slug, or a title
 * to a UUID.
 *
 * Resolution order:
 *   1. If the input is a UUID, return it unchanged (no HTTP calls).
 *   2. Try the `/documents/by-slug/:slug` resolver — slugs are URL-safe and
 *      low-cardinality, so this is the common case for Phase C callers.
 *   3. Fall back to a title search via `/documents/search?query=...`. An
 *      exact case-insensitive title match wins; otherwise, if exactly one
 *      document is returned we treat it as the match. Ambiguous results
 *      (2+ rows with no exact title match) return `null` so callers surface
 *      a clean "Brief document not found" instead of operating on the wrong
 *      document.
 *
 * Same contract as `resolveBeaconId` — returns the UUID on success, or
 * `null` if the input does not resolve to a document visible to the current
 * caller.
 */
export async function resolveDocumentId(
  client: SlugResolverClient,
  idOrSlugOrTitle: string,
): Promise<string | null> {
  if (isUuid(idOrSlugOrTitle)) return idOrSlugOrTitle;
  // Try slug first — Phase C behavior.
  const slugResult = await client.request(
    'GET',
    `/documents/by-slug/${encodeURIComponent(idOrSlugOrTitle)}`,
  );
  if (slugResult.ok) {
    const envelope = slugResult.data as { data?: { id?: string } } | null;
    const id = envelope?.data?.id;
    if (id) return id;
  }
  // Fallback: title search via the search endpoint.
  return resolveDocumentIdByTitle(client, idOrSlugOrTitle);
}

/**
 * Title-based fallback for {@link resolveDocumentId}. Exported for tests and
 * for callers that want to *force* a title search (skipping the slug probe).
 *
 * Strategy: query the Brief search endpoint (which ILIKE-matches title and
 * plain_text), prefer an exact case-insensitive title match, otherwise
 * accept a lone result. Anything ambiguous returns `null`.
 *
 * Note: the Brief search endpoint ignores an explicit `limit` query param —
 * it always returns up to 50 rows ordered by `updated_at desc`. That's fine
 * for our needs because we only inspect the first few entries for an exact
 * title match.
 */
export async function resolveDocumentIdByTitle(
  client: SlugResolverClient,
  query: string,
): Promise<string | null> {
  const result = await client.request(
    'GET',
    `/documents/search?query=${encodeURIComponent(query)}`,
  );
  if (!result.ok) return null;
  const envelope = result.data as {
    data?: Array<{ id: string; title: string }>;
  } | null;
  const docs = envelope?.data ?? [];
  if (docs.length === 0) return null;
  const needle = query.toLowerCase();
  const exact = docs.find((d) => d.title.toLowerCase() === needle);
  if (exact) return exact.id;
  if (docs.length === 1) return docs[0]!.id;
  return null;
}

/**
 * Minimal shape we rely on from the Bam `ApiClient` for the task/project
 * resolvers. Kept structural so tests can stub it without importing the
 * concrete class.
 */
export interface BamApiResolverClient {
  get(path: string): Promise<{ ok: boolean; status: number; data: unknown }>;
}

/**
 * Resolve a Bam task identifier that may be a UUID or a human ref like
 * `FRND-42`, returning the task's UUID.
 *
 * Anything that isn't a UUID and doesn't look like a `PREFIX-123` ref is
 * rejected with `null` so callers can surface "Task not found" cleanly
 * rather than forwarding garbage to the API. The underlying
 * `/tasks/by-ref/:ref` endpoint enforces org + project-membership auth, so
 * callers cannot see tasks they lack access to.
 */
export async function resolveTaskId(
  api: BamApiResolverClient,
  idOrHumanId: string,
): Promise<string | null> {
  if (isUuid(idOrHumanId)) return idOrHumanId;
  if (!/^[A-Za-z]{2,10}-\d+$/.test(idOrHumanId)) return null;
  const result = await api.get(`/tasks/by-ref/${encodeURIComponent(idOrHumanId)}`);
  if (!result.ok) return null;
  const envelope = result.data as { data?: { id?: string } } | null;
  return envelope?.data?.id ?? null;
}

/**
 * Resolve a Bam project identifier that may be a UUID or a human project
 * name, returning the project's UUID.
 *
 * Strategy: if the input is a UUID, return it unchanged; otherwise list the
 * caller's projects via `GET /projects` and look for a case-insensitive
 * exact name match. The list endpoint already scopes results to the
 * caller's org and membership, so this cannot leak projects the caller
 * can't already see.
 *
 * Returns `null` on miss — including when multiple projects share the same
 * name (ambiguity is surfaced as "project not found" for safety).
 */
export async function resolveProjectId(
  api: BamApiResolverClient,
  nameOrId: string,
): Promise<string | null> {
  if (isUuid(nameOrId)) return nameOrId;
  const result = await api.get('/projects');
  if (!result.ok) return null;
  const envelope = result.data as {
    data?: Array<{ id: string; name: string }>;
  } | null;
  const projects = envelope?.data ?? [];
  const needle = nameOrId.toLowerCase();
  const matches = projects.filter((p) => p.name.toLowerCase() === needle);
  if (matches.length === 1) return matches[0]!.id;
  return null;
}
