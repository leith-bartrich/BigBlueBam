import { useState } from 'react';
import { Search as SearchIcon, Hash } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatRelativeTime, truncate } from '@/lib/utils';
import { markdownToHtml, sanitizeHtml } from '@/lib/markdown';

interface SearchResult {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_slug: string;
  author_display_name: string;
  content: string;
  created_at: string;
}

interface SearchPageProps {
  onNavigate: (path: string) => void;
}

export function SearchPage({ onNavigate }: SearchPageProps) {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', searchTerm],
    queryFn: () =>
      api.get<{ data: SearchResult[] }>('/search', { q: searchTerm }).then((r) => r.data),
    enabled: searchTerm.length >= 2,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(query.trim());
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 h-14 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Search</h2>
      </header>

      <div className="px-6 py-4">
        <form onSubmit={handleSearch} className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors"
          />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        )}

        {searchTerm && !isLoading && (!results || results.length === 0) && (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm mt-1">Try different keywords</p>
          </div>
        )}

        {!searchTerm && (
          <div className="text-center py-12 text-zinc-500">
            <SearchIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Search across all channels</p>
            <p className="text-sm mt-1">Find messages, files, and more</p>
          </div>
        )}

        <div className="space-y-2">
          {results?.map((result) => (
            <button
              key={result.id}
              onClick={() => onNavigate(`/channels/${result.channel_slug}`)}
              className="w-full text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                <Hash className="h-3 w-3" />
                <span>{result.channel_name}</span>
                <span>-</span>
                <span>{result.author_display_name}</span>
                <span>-</span>
                <span>{formatRelativeTime(result.created_at)}</span>
              </div>
              <div
                className="rich-text-content text-sm text-zinc-800 dark:text-zinc-200 line-clamp-3"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(markdownToHtml(truncate(result.content, 300))),
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
