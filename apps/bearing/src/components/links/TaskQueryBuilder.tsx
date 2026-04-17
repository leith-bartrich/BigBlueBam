import { useState, useMemo } from 'react';
import { Search, Check, Loader2, ListFilter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { bbbGet } from '@/lib/bbb-api';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Task {
  id: string;
  title: string;
  sequence_number: number | null;
  state_name: string | null;
}

interface TaskListResponse {
  data: Task[];
}

interface TaskQueryBuilderProps {
  projectId: string;
  /** Currently selected task IDs (multi-select). */
  selectedIds: string[];
  onToggle: (taskId: string, taskTitle: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TaskQueryBuilder lets the user search and select individual tasks from
 * a Bam project. Selected tasks become linked progress sources for a KR.
 *
 * The Bam API exposes GET /projects/:id/tasks. If that endpoint is
 * unavailable the component renders a text-input fallback message so the
 * user can fall back to manual ID entry.
 */
export function TaskQueryBuilder({
  projectId,
  selectedIds,
  onToggle,
}: TaskQueryBuilderProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bbb', 'tasks', 'list', projectId],
    queryFn: () =>
      bbbGet<TaskListResponse>(`/projects/${projectId}/tasks?limit=200`),
    enabled: !!projectId,
    staleTime: 30_000,
    retry: 1,
  });

  const tasks = data?.data ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.sequence_number !== null && String(t.sequence_number).includes(q)),
    );
  }, [tasks, search]);

  if (isError) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Unable to load tasks from the Bam API. You can still enter task
          IDs manually using the ID field above.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
        <ListFilter className="h-3.5 w-3.5" />
        Select Tasks
        {selectedIds.length > 0 && (
          <span className="text-xs font-normal text-zinc-400">
            ({selectedIds.length} selected)
          </span>
        )}
      </label>

      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
        />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-4 text-center text-sm text-zinc-400">
            {tasks.length === 0 ? 'No tasks in this project' : 'No matching tasks'}
          </div>
        ) : (
          filtered.map((task) => {
            const isSelected = selectedIds.includes(task.id);
            return (
              <button
                key={task.id}
                onClick={() => onToggle(task.id, task.title)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors',
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center h-4 w-4 rounded border shrink-0 transition-colors',
                    isSelected
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-zinc-300 dark:border-zinc-600',
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </span>
                {task.sequence_number !== null && (
                  <span className="text-xs font-mono text-zinc-400 shrink-0">
                    #{task.sequence_number}
                  </span>
                )}
                <span className="truncate flex-1 text-left text-zinc-900 dark:text-zinc-100">
                  {task.title}
                </span>
                {task.state_name && (
                  <span className="text-[10px] text-zinc-400 shrink-0">
                    {task.state_name}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
