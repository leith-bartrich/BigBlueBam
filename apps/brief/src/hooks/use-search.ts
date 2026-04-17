import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { BriefDocument, DocumentStatus } from '@/hooks/use-documents';

// ── Response types ──────────────────────────────────────────────────

export interface DocumentSearchResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: DocumentStatus;
  creator_name: string | null;
  updated_at: string;
  relevance_score: number;
}

interface SearchResponse {
  data: DocumentSearchResult[];
  meta?: {
    total: number;
  };
}

export interface DocumentSearchFilters {
  status?: DocumentStatus;
  project_id?: string;
}

// ── Search hook ─────────────────────────────────────────────────────

/**
 * GET /documents/search?q=...&status=...&project_id=...
 * Debounces the query string by 300ms to avoid excessive API calls.
 */
export function useDocumentSearch(query: string, filters: DocumentSearchFilters = {}) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return useQuery({
    queryKey: ['document-search', debouncedQuery, filters],
    queryFn: () =>
      api.get<SearchResponse>('/documents/search', {
        q: debouncedQuery,
        ...filters,
      }),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    select: (res) => res.data,
  });
}

// ── Semantic search hook ───────────────────────────────────────────

export interface SemanticSearchResult {
  id: string;
  title: string;
  excerpt: string | null;
  chunk_index: number;
  score: number;
}

interface SemanticSearchResponse {
  data: SemanticSearchResult[];
  meta?: {
    source: 'vector' | 'text' | 'text_fallback';
    count?: number;
  };
}

/**
 * GET /documents/semantic-search?q=...&limit=...
 *
 * Queries the Qdrant vector index for documents semantically similar to the
 * query. Falls back to regular text search when Qdrant is not configured.
 * Debounces by 400ms to avoid excessive API calls.
 */
export function useSemanticSearch(query: string, limit = 20) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return useQuery({
    queryKey: ['document-semantic-search', debouncedQuery, limit],
    queryFn: () =>
      api.get<SemanticSearchResponse>('/documents/semantic-search', {
        q: debouncedQuery,
        limit,
      }),
    enabled: debouncedQuery.trim().length >= 3,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    select: (res) => ({
      results: res.data,
      source: res.meta?.source ?? 'text',
    }),
  });
}
