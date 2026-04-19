import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { Task, Phase } from '@bigbluebam/shared';
import { PRIORITIES } from '@bigbluebam/shared';
import { cn, formatDate, isOverdue } from '@/lib/utils';
import { Badge } from '@/components/common/badge';
import { Select } from '@/components/common/select';

type SortField = 'human_id' | 'title' | 'state_name' | 'phase_name' | 'assignee' | 'priority' | 'story_points' | 'due_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface ListViewProps {
  phases: (Phase & { tasks: Task[] })[];
  onTaskClick: (taskId: string) => void;
  onUpdateTask?: (taskId: string, data: Partial<Task>) => void;
}

const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

// PriorityIcon removed — not currently rendered by this view. Reintroduce
// from git history if columns start showing priority badges again.

export function ListView({ phases, onTaskClick, onUpdateTask }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const allTasks = useMemo(() => {
    const tasks: (Task & { phase_name?: string; state_name?: string })[] = [];
    for (const phase of phases) {
      for (const task of phase.tasks) {
        tasks.push({ ...task, phase_name: phase.name });
      }
    }
    return tasks;
  }, [phases]);

  const sortedTasks = useMemo(() => {
    const sorted = [...allTasks];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'human_id':
          cmp = (a.human_id ?? '').localeCompare(b.human_id ?? '');
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'state_name':
          cmp = ((a as { state_name?: string }).state_name ?? '').localeCompare((b as { state_name?: string }).state_name ?? '');
          break;
        case 'phase_name':
          cmp = ((a as { phase_name?: string }).phase_name ?? '').localeCompare((b as { phase_name?: string }).phase_name ?? '');
          break;
        case 'priority':
          cmp = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
          break;
        case 'story_points':
          cmp = (a.story_points ?? 0) - (b.story_points ?? 0);
          break;
        case 'due_date':
          cmp = (a.due_date ?? '').localeCompare(b.due_date ?? '');
          break;
        case 'created_at':
          cmp = a.created_at.localeCompare(b.created_at);
          break;
        default:
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [allTasks, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-zinc-300" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-primary-500" />
      : <ArrowDown className="h-3 w-3 text-primary-500" />;
  };

  const priorityOptions = PRIORITIES.map((p) => ({
    value: p,
    label: p.charAt(0).toUpperCase() + p.slice(1),
  }));

  const columns: { field: SortField; label: string; className: string }[] = [
    { field: 'human_id', label: 'ID', className: 'w-24' },
    { field: 'title', label: 'Title', className: 'flex-1 min-w-[200px]' },
    { field: 'phase_name', label: 'Phase', className: 'w-28' },
    { field: 'priority', label: 'Priority', className: 'w-32' },
    { field: 'story_points', label: 'Points', className: 'w-20' },
    { field: 'due_date', label: 'Due Date', className: 'w-28' },
    { field: 'created_at', label: 'Created', className: 'w-28' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Table header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-medium text-zinc-500 uppercase tracking-wider shrink-0">
        {columns.map((col) => (
          <button
            key={col.field}
            onClick={() => handleSort(col.field)}
            className={cn(
              'flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors',
              col.className,
            )}
          >
            {col.label}
            <SortIcon field={col.field} />
          </button>
        ))}
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-y-auto">
        {sortedTasks.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-zinc-400">
            No tasks found.
          </div>
        ) : (
          sortedTasks.map((task) => {
            const overdue = isOverdue(task.due_date);
            return (
              <div
                key={task.id}
                className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors text-sm"
                onClick={() => onTaskClick(task.id)}
              >
                {/* ID */}
                <div className="w-24 font-mono text-xs text-zinc-400 truncate">
                  {task.human_id}
                </div>

                {/* Title */}
                <div className="flex-1 min-w-[200px] text-zinc-900 dark:text-zinc-100 font-medium truncate">
                  {task.title}
                </div>

                {/* Phase */}
                <div className="w-28 truncate">
                  <Badge variant="default">
                    {(task as { phase_name?: string }).phase_name ?? '-'}
                  </Badge>
                </div>

                {/* Priority - inline editable */}
                <div className="w-32" onClick={(e) => e.stopPropagation()}>
                  <Select
                    options={priorityOptions}
                    value={task.priority}
                    onValueChange={(val) => onUpdateTask?.(task.id, { priority: val as Priority })}
                    className="w-full"
                  />
                </div>

                {/* Story Points - inline editable */}
                <div className="w-20" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    min={0}
                    value={task.story_points ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                      onUpdateTask?.(task.id, { story_points: val } as Partial<Task>);
                    }}
                    className="w-full rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:text-zinc-100"
                    placeholder="-"
                  />
                </div>

                {/* Due Date */}
                <div className={cn('w-28 text-xs', overdue ? 'text-red-600 font-medium' : 'text-zinc-500')}>
                  {task.due_date ? formatDate(task.due_date) : '-'}
                </div>

                {/* Created */}
                <div className="w-28 text-xs text-zinc-400">
                  {formatDate(task.created_at)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
