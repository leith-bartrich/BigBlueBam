import { useState } from 'react';
import { Bookmark, ChevronDown, Trash2, Loader2 } from 'lucide-react';
import { useSavedQueries, useDeleteSavedQuery } from '@/hooks/use-search';
import { useSearchStore } from '@/stores/search.store';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function SavedQueriesPanel() {
  const [open, setOpen] = useState(false);
  const { data: queries, isLoading } = useSavedQueries();
  const deleteQuery = useDeleteSavedQuery();
  const fromSearchRequest = useSearchStore((s) => s.fromSearchRequest);

  const handleLoad = (queryBody: Parameters<typeof fromSearchRequest>[0]) => {
    fromSearchRequest(queryBody);
    setOpen(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteQuery.mutate(id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
          open
            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800',
        )}
      >
        <Bookmark className="h-3.5 w-3.5" />
        Saved queries
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : !queries || queries.length === 0 ? (
            <p className="px-4 py-4 text-sm text-zinc-400 dark:text-zinc-500 text-center">
              No saved queries yet.
            </p>
          ) : (
            queries.map((q) => (
              <div
                key={q.id}
                className="group flex items-start justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                onClick={() => handleLoad(q.query_body)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {q.name}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {q.scope} &middot; {formatRelativeTime(q.created_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(q.id, e)}
                  className="mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                  title="Delete saved query"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
