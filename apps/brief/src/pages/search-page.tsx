import { useState } from 'react';
import { Search, Loader2, FileText } from 'lucide-react';
import { useDocumentSearch } from '@/hooks/use-search';
import { StatusBadge } from '@/components/document/status-badge';
import { formatRelativeTime } from '@/lib/utils';

interface SearchPageProps {
  onNavigate: (path: string) => void;
}

export function SearchPage({ onNavigate }: SearchPageProps) {
  const [query, setQuery] = useState('');
  const { data: results, isLoading, isFetching } = useDocumentSearch(query);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Search Documents</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Find documents by title, content, or author.
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
        <input
          type="text"
          placeholder="Type to search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-12 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
        />
        {isFetching && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary-500" />
        )}
      </div>

      {/* Results */}
      {query.trim().length < 2 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400">
            Type at least 2 characters to search.
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : !results || results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400">
            No documents found for "{query}".
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => onNavigate(`/documents/${result.slug ?? result.id}`)}
              className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {result.title}
                </p>
                {result.excerpt && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {result.excerpt}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                  {result.author_name && <span>{result.author_name}</span>}
                  <span>{formatRelativeTime(result.updated_at)}</span>
                </div>
              </div>
              <StatusBadge status={result.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
