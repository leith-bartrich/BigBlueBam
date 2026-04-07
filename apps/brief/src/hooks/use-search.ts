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
