import { useEffect, useRef } from 'react';
import { useSearchStore } from '@/stores/search.store';
import { useBeaconSearch } from '@/hooks/use-search';
import { deserializeFromUrl } from '@/lib/query-serializer';
import { QueryBuilder } from '@/components/search/query-builder';
import { ResultList } from '@/components/search/result-list';
import { SavedQueriesPanel } from '@/components/search/saved-queries-panel';

interface BeaconSearchPageProps {
  onNavigate: (path: string) => void;
}

export function BeaconSearchPage({ onNavigate }: BeaconSearchPageProps) {
  const store = useSearchStore();
  const hydratedRef = useRef(false);

  // Hydrate from URL on mount (once)
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlState = deserializeFromUrl(params);
    if (urlState) {
      store.fromSerializable(urlState);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the search request from current store state
  const searchRequest = store.toSearchRequest();

  const hasActiveQuery =
    searchRequest.query.trim().length > 0 ||
    (searchRequest.filters.project_ids?.length ?? 0) > 0 ||
    (searchRequest.filters.tags?.length ?? 0) > 0 ||
    !!searchRequest.filters.expires_after ||
    !!searchRequest.filters.visibility_max;

  const { data: searchResponse, isFetching, isError, error } = useBeaconSearch(searchRequest);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Search</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Find knowledge across all accessible Beacons.
          </p>
        </div>
        <SavedQueriesPanel />
      </div>

      {/* Query builder */}
      <QueryBuilder />

      {/* Results */}
      <div className="mt-6">
        {isError ? (
          <div className="py-16 text-center">
            <p className="text-red-600 dark:text-red-400 mb-2">
              Search failed: {(error as Error)?.message ?? 'An unexpected error occurred.'}
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              Try again or adjust your search filters.
            </p>
          </div>
        ) : (
          <ResultList
            results={searchResponse?.results ?? []}
            totalCandidates={searchResponse?.total_candidates ?? 0}
            retrievalStages={
              searchResponse?.retrieval_stages ?? {
                semantic_hits: 0,
                tag_expansion_hits: 0,
                link_traversal_hits: 0,
                fulltext_fallback_hits: 0,
              }
            }
            currentTags={store.tags}
            isLoading={isFetching}
            hasActiveQuery={hasActiveQuery}
            onNavigate={onNavigate}
            onAddTag={store.addTag}
            onClearFilters={store.reset}
          />
        )}
      </div>
    </div>
  );
}
