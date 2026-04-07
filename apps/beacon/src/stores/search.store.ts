import { create } from 'zustand';
import type { SerializableSearchState } from '@/lib/query-serializer';
import { pushSearchStateToUrl } from '@/lib/query-serializer';

// ── Search request type (§5.2 format) ───────────────────────────────

export interface SearchRequest {
  query: string;
  filters: {
    project_ids?: string[];
    tags?: string[];
    status?: string[];
    visibility_max?: string;
    expires_after?: string;
  };
  options: {
    include_graph_expansion: boolean;
    include_tag_expansion: boolean;
    include_fulltext_fallback: boolean;
    rerank: boolean;
    top_k: number;
    group_by_beacon: boolean;
  };
}

// ── Store shape ─────────────────────────────────────────────────────

interface SearchState {
  // Filter fields
  queryText: string;
  projectIds: string[];
  tags: string[];
  statusFilters: string[];
  expiresAfter: string | null;
  includeGraphExpansion: boolean;
  includeTagExpansion: boolean;
  includeFulltextFallback: boolean;
  visibilityMax: string | null;

  // UI state
  advancedExpanded: boolean;

  // Actions
  setQueryText: (text: string) => void;
  setProjectIds: (ids: string[]) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  setTags: (tags: string[]) => void;
  setStatusFilters: (statuses: string[]) => void;
  toggleStatus: (status: string) => void;
  setExpiresAfter: (value: string | null) => void;
  setIncludeGraphExpansion: (value: boolean) => void;
  setIncludeTagExpansion: (value: boolean) => void;
  setIncludeFulltextFallback: (value: boolean) => void;
  setVisibilityMax: (value: string | null) => void;
  setAdvancedExpanded: (expanded: boolean) => void;

  /** Serialize the current state to §5.2 SearchRequest format. */
  toSearchRequest: (topK?: number) => SearchRequest;

  /** Hydrate from a saved query or URL-deserialized state. */
  fromSearchRequest: (body: SearchRequest) => void;

  /** Hydrate from the serializable URL state object. */
  fromSerializable: (state: SerializableSearchState) => void;

  /** Reset all filters to defaults. */
  reset: () => void;
}

// ── Persist advanced-expanded to localStorage ───────────────────────

function loadAdvancedExpanded(): boolean {
  try {
    return localStorage.getItem('beacon_query_advanced_expanded') === 'true';
  } catch {
    return false;
  }
}

function saveAdvancedExpanded(expanded: boolean): void {
  try {
    localStorage.setItem('beacon_query_advanced_expanded', String(expanded));
  } catch {
    // ignore
  }
}

// ── URL sync helper ─────────────────────────────────────────────────

function syncUrl(state: SearchState): void {
  pushSearchStateToUrl({
    queryText: state.queryText,
    projectIds: state.projectIds,
    tags: state.tags,
    statusFilters: state.statusFilters,
    expiresAfter: state.expiresAfter,
    includeGraphExpansion: state.includeGraphExpansion,
    includeTagExpansion: state.includeTagExpansion,
    includeFulltextFallback: state.includeFulltextFallback,
    visibilityMax: state.visibilityMax,
  });
}

// ── Defaults ────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  queryText: '',
  projectIds: [] as string[],
  tags: [] as string[],
  statusFilters: ['Active'],
  expiresAfter: null as string | null,
  includeGraphExpansion: true,
  includeTagExpansion: true,
  includeFulltextFallback: true,
  visibilityMax: null as string | null,
};

// ── Store ───────────────────────────────────────────────────────────

export const useSearchStore = create<SearchState>((set, get) => ({
  ...DEFAULT_STATE,
  advancedExpanded: loadAdvancedExpanded(),

  setQueryText: (text) => {
    set({ queryText: text });
    syncUrl(get());
  },

  setProjectIds: (ids) => {
    set({ projectIds: ids });
    syncUrl(get());
  },

  addTag: (tag) => {
    const current = get().tags;
    if (!current.includes(tag)) {
      set({ tags: [...current, tag] });
      syncUrl(get());
    }
  },

  removeTag: (tag) => {
    set((s) => ({ tags: s.tags.filter((t) => t !== tag) }));
    syncUrl(get());
  },

  setTags: (tags) => {
    set({ tags });
    syncUrl(get());
  },

  setStatusFilters: (statuses) => {
    set({ statusFilters: statuses });
    syncUrl(get());
  },

  toggleStatus: (status) => {
    const current = get().statusFilters;
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    set({ statusFilters: next });
    syncUrl(get());
  },

  setExpiresAfter: (value) => {
    set({ expiresAfter: value });
    syncUrl(get());
  },

  setIncludeGraphExpansion: (value) => {
    set({ includeGraphExpansion: value });
    syncUrl(get());
  },

  setIncludeTagExpansion: (value) => {
    set({ includeTagExpansion: value });
    syncUrl(get());
  },

  setIncludeFulltextFallback: (value) => {
    set({ includeFulltextFallback: value });
    syncUrl(get());
  },

  setVisibilityMax: (value) => {
    set({ visibilityMax: value });
    syncUrl(get());
  },

  setAdvancedExpanded: (expanded) => {
    set({ advancedExpanded: expanded });
    saveAdvancedExpanded(expanded);
  },

  toSearchRequest: (topK = 20) => {
    const s = get();
    const filters: SearchRequest['filters'] = {};
    if (s.projectIds.length > 0) filters.project_ids = s.projectIds;
    if (s.tags.length > 0) filters.tags = s.tags;
    if (s.statusFilters.length > 0) filters.status = s.statusFilters;
    if (s.visibilityMax) filters.visibility_max = s.visibilityMax;
    if (s.expiresAfter) filters.expires_after = s.expiresAfter;

    return {
      query: s.queryText,
      filters,
      options: {
        include_graph_expansion: s.includeGraphExpansion,
        include_tag_expansion: s.includeTagExpansion,
        include_fulltext_fallback: s.includeFulltextFallback,
        rerank: true,
        top_k: topK,
        group_by_beacon: true,
      },
    };
  },

  fromSearchRequest: (body) => {
    set({
      queryText: body.query ?? '',
      projectIds: body.filters?.project_ids ?? [],
      tags: body.filters?.tags ?? [],
      statusFilters: body.filters?.status ?? ['Active'],
      expiresAfter: body.filters?.expires_after ?? null,
      visibilityMax: body.filters?.visibility_max ?? null,
      includeGraphExpansion: body.options?.include_graph_expansion ?? true,
      includeTagExpansion: body.options?.include_tag_expansion ?? true,
      includeFulltextFallback: body.options?.include_fulltext_fallback ?? true,
    });
    syncUrl(get());
  },

  fromSerializable: (state) => {
    set({
      queryText: state.queryText,
      projectIds: state.projectIds,
      tags: state.tags,
      statusFilters: state.statusFilters,
      expiresAfter: state.expiresAfter,
      includeGraphExpansion: state.includeGraphExpansion,
      includeTagExpansion: state.includeTagExpansion,
      includeFulltextFallback: state.includeFulltextFallback,
      visibilityMax: state.visibilityMax,
    });
    // Don't sync URL here — the URL is the source on hydration
  },

  reset: () => {
    set({ ...DEFAULT_STATE });
    syncUrl(get());
  },
}));
