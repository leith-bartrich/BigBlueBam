import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { SearchRequest } from '@/stores/search.store';
import type { BeaconStatus } from '@/hooks/use-beacons';

// ── Response types (§5.3) ───────────────────────────────────────────

export interface SearchResultLinkedBeacon {
  id: string;
  title: string;
  slug?: string;
  link_type: string;
}

export interface SearchResult {
  beacon_id: string;
  slug: string;
  title: string;
  summary: string;
  status: BeaconStatus;
  relevance_score: number;
  match_sources: string[];
  expires_at: string | null;
  last_verified_at: string | null;
  verification_count: number;
  tags: string[];
  linked_beacons: SearchResultLinkedBeacon[];
  highlight: string | null;
  owned_by?: string;
  owner_name?: string;
}

export interface RetrievalStages {
  semantic_hits: number;
  tag_expansion_hits: number;
  link_traversal_hits: number;
  fulltext_fallback_hits: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total_candidates: number;
  retrieval_stages: RetrievalStages;
}

export interface SavedQuery {
  id: string;
  name: string;
  description: string | null;
  query_body: SearchRequest;
  scope: 'Private' | 'Project' | 'Organization';
  created_at: string;
  updated_at: string;
}

export interface SearchSuggestion {
  text: string;
  type: 'title' | 'tag';
}

// ── Search hooks ────────────────────────────────────────────────────

/**
 * POST /search — returns full results + retrieval_stages.
 * Only fires when the request has a query or at least one filter.
 */
export function useBeaconSearch(request: SearchRequest) {
  const hasQuery = request.query.trim().length > 0;
  const hasFilters =
    (request.filters.project_ids?.length ?? 0) > 0 ||
    (request.filters.tags?.length ?? 0) > 0 ||
    (request.filters.status?.length ?? 0) > 0 ||
    !!request.filters.expires_after ||
    !!request.filters.visibility_max;

  return useQuery({
    queryKey: ['beacon-search', request],
    queryFn: () => api.post<SearchResponse>('/search', request),
    enabled: hasQuery || hasFilters,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

/**
 * POST /search with top_k=0 — returns only total_candidates (count-only mode).
 * Debounced via the 300ms pattern in the query builder.
 */
export function useBeaconSearchCount(request: SearchRequest) {
  const countRequest = {
    ...request,
    options: { ...request.options, top_k: 0 },
  };

  const hasQuery = request.query.trim().length > 0;
  const hasFilters =
    (request.filters.project_ids?.length ?? 0) > 0 ||
    (request.filters.tags?.length ?? 0) > 0 ||
    (request.filters.status?.length ?? 0) > 0 ||
    !!request.filters.expires_after ||
    !!request.filters.visibility_max;

  return useQuery({
    queryKey: ['beacon-search-count', countRequest],
    queryFn: () => api.post<SearchResponse>('/search', countRequest),
    enabled: hasQuery || hasFilters,
    staleTime: 30_000,
    select: (res) => res.total_candidates,
  });
}

/**
 * GET /search/suggest?q=prefix — typeahead suggestions, debounced.
 */
export function useSearchSuggestions(prefix: string) {
  const [debouncedPrefix, setDebouncedPrefix] = useState(prefix);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedPrefix(prefix);
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [prefix]);

  return useQuery({
    queryKey: ['beacon-search-suggest', debouncedPrefix],
    queryFn: () =>
      api.get<{ suggestions: SearchSuggestion[] }>('/search/suggest', { q: debouncedPrefix }),
    enabled: debouncedPrefix.length >= 2,
    staleTime: 60_000,
    select: (res) => res.suggestions,
  });
}

// ── Saved queries ───────────────────────────────────────────────────

export function useSavedQueries() {
  return useQuery({
    queryKey: ['beacon-saved-queries'],
    queryFn: () => api.get<{ data: SavedQuery[] }>('/search/saved'),
    select: (res) => res.data,
  });
}

export function useSaveQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      query_body: SearchRequest;
      scope?: 'Private' | 'Project' | 'Organization';
    }) => api.post<{ data: SavedQuery }>('/search/saved', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beacon-saved-queries'] });
    },
  });
}

export function useDeleteSavedQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/search/saved/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beacon-saved-queries'] });
    },
  });
}
