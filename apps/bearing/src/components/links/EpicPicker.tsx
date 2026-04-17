import { useState } from 'react';
import { Search, Check, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { bbbGet } from '@/lib/bbb-api';
import { cn } from '@/lib/utils';

interface Epic {
  id: string;
  name: string;
  color: string | null;
}

interface EpicListResponse {
  data: Epic[];
}

interface EpicPickerProps {
  projectId: string;
  onSelect: (epicId: string, epicName: string) => void;
  selectedId: string;
}

/**
 * EpicPicker fetches epics from the Bam API for a given project
 * and presents them in a searchable list. If the Bam API endpoint
 * is unavailable or the response is empty, it degrades to a
 * text-input fallback (handled by the parent LinkEditor).
 */
export function EpicPicker({ projectId, onSelect, selectedId }: EpicPickerProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bbb', 'epics', 'list', projectId],
    queryFn: () => bbbGet<EpicListResponse>(`/projects/${projectId}/epics`),
    enabled: !!projectId,
    staleTime: 60_000,
    retry: 1,
  });

  const epics = data?.data ?? [];

  const filtered = search.trim()
    ? epics.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()),
      )
    : epics;

  if (isError) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Unable to load epics from the Bam API. Enter the epic ID manually in
          the ID field above.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">
        Select Epic
      </label>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search epics..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
        />
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-4 text-center text-sm text-zinc-400">
            {epics.length === 0
              ? 'No epics in this project'
              : 'No matching epics'}
          </div>
        ) : (
          filtered.map((epic) => {
            const isSelected = selectedId === epic.id;
            return (
              <button
                key={epic.id}
                onClick={() => onSelect(epic.id, epic.name)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-colors',
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800',
                )}
              >
                <span
                  className="flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: epic.color ?? '#7c3aed' }}
                >
                  E
                </span>
                <span className="truncate flex-1 text-left text-zinc-900 dark:text-zinc-100">
                  {epic.name}
                </span>
                {isSelected && <Check className="h-4 w-4 text-primary-600 shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
