/**
 * URL state serialization for Beacon search queries.
 *
 * Two URL forms are supported:
 *   Simple:  ?text=X&tags=a,b&project=uuid&status=Active,PendingReview
 *   Full:    ?q=<base64url-encoded JSON>
 *
 * The `q` parameter takes precedence when present.
 */

export interface SerializableSearchState {
  queryText: string;
  projectIds: string[];
  tags: string[];
  statusFilters: string[];
  expiresAfter: string | null;
  includeGraphExpansion: boolean;
  includeTagExpansion: boolean;
  includeFulltextFallback: boolean;
  visibilityMax: string | null;
}

// ── Base64url helpers ────────────────────────────────────────────────

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  let padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) padded += '=';
  return atob(padded);
}

// ── Defaults for diffing ────────────────────────────────────────────

const DEFAULTS: SerializableSearchState = {
  queryText: '',
  projectIds: [],
  tags: [],
  statusFilters: ['Active'],
  expiresAfter: null,
  includeGraphExpansion: true,
  includeTagExpansion: true,
  includeFulltextFallback: true,
  visibilityMax: null,
};

function isSimpleQuery(state: SerializableSearchState): boolean {
  return (
    arraysEqual(state.statusFilters, DEFAULTS.statusFilters) &&
    state.expiresAfter === DEFAULTS.expiresAfter &&
    state.includeGraphExpansion === DEFAULTS.includeGraphExpansion &&
    state.includeTagExpansion === DEFAULTS.includeTagExpansion &&
    state.includeFulltextFallback === DEFAULTS.includeFulltextFallback &&
    state.visibilityMax === DEFAULTS.visibilityMax
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted1 = [...a].sort();
  const sorted2 = [...b].sort();
  return sorted1.every((v, i) => v === sorted2[i]);
}

// ── Serialize ───────────────────────────────────────────────────────

export function serializeToUrl(state: SerializableSearchState): string {
  const params = new URLSearchParams();

  // For simple queries use human-readable params
  if (isSimpleQuery(state)) {
    if (state.queryText) params.set('text', state.queryText);
    if (state.tags.length > 0) params.set('tags', state.tags.join(','));
    if (state.projectIds.length > 0) params.set('project', state.projectIds.join(','));
    return params.toString();
  }

  // Full form: encode the entire state as base64url JSON
  const json = JSON.stringify(state);
  params.set('q', toBase64Url(json));
  return params.toString();
}

/**
 * Update the browser URL with the current search state without creating a
 * history entry (replaceState).
 */
export function pushSearchStateToUrl(state: SerializableSearchState): void {
  const qs = serializeToUrl(state);
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

// ── Deserialize ─────────────────────────────────────────────────────

export function deserializeFromUrl(searchParams: URLSearchParams): SerializableSearchState | null {
  // Full form takes precedence
  const q = searchParams.get('q');
  if (q) {
    try {
      const json = fromBase64Url(q);
      const parsed = JSON.parse(json) as Partial<SerializableSearchState>;
      return {
        queryText: parsed.queryText ?? DEFAULTS.queryText,
        projectIds: parsed.projectIds ?? DEFAULTS.projectIds,
        tags: parsed.tags ?? DEFAULTS.tags,
        statusFilters: parsed.statusFilters ?? DEFAULTS.statusFilters,
        expiresAfter: parsed.expiresAfter ?? DEFAULTS.expiresAfter,
        includeGraphExpansion: parsed.includeGraphExpansion ?? DEFAULTS.includeGraphExpansion,
        includeTagExpansion: parsed.includeTagExpansion ?? DEFAULTS.includeTagExpansion,
        includeFulltextFallback: parsed.includeFulltextFallback ?? DEFAULTS.includeFulltextFallback,
        visibilityMax: parsed.visibilityMax ?? DEFAULTS.visibilityMax,
      };
    } catch {
      // Fall through to simple form
    }
  }

  // Simple form
  const text = searchParams.get('text');
  const tags = searchParams.get('tags');
  const project = searchParams.get('project');

  if (!text && !tags && !project) return null;

  return {
    ...DEFAULTS,
    queryText: text ?? '',
    tags: tags ? tags.split(',').filter(Boolean) : [],
    projectIds: project ? project.split(',').filter(Boolean) : [],
  };
}
