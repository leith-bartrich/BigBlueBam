import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { Phase, Task } from '@bigbluebam/shared';
import { cn } from '@/lib/utils';
import { TaskCard } from './task-card';
import { InlineTaskInput } from './inline-task-input';

interface PhaseColumnProps {
  phase: Phase & { tasks: Task[] };
  onTaskClick: (taskId: string) => void;
  onAddTask: (phaseId: string) => void;
  onInlineCreate?: (phaseId: string, title: string) => Promise<void>;
}

export function PhaseColumn({ phase, onTaskClick, onAddTask, onInlineCreate }: PhaseColumnProps) {
  const [isCreating, setIsCreating] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `phase-${phase.id}`,
    data: { type: 'phase', phaseId: phase.id },
  });

  const taskCount = phase.tasks.length;
  const isOverWip = phase.wip_limit != null && taskCount > phase.wip_limit;
  const taskIds = phase.tasks.map((t) => t.id);

  return (
    <div
      className={cn(
        'flex flex-col w-72 shrink-0 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/50 transition-all duration-150',
        isOver && 'ring-2 ring-primary-400 bg-primary-50/50 dark:bg-primary-950/20 scale-[1.005]',
      )}
    >
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          {phase.color && (
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
          )}
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{phase.name}</h3>
          <span
            className={cn(
              'inline-flex items-center justify-center h-5 min-w-[20px] rounded-full text-xs font-medium px-1.5',
              isOverWip
                ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
            )}
          >
            {taskCount}
            {phase.wip_limit != null && `/${phase.wip_limit}`}
          </span>
        </div>
        <button
          onClick={() => {
            if (onInlineCreate) {
              setIsCreating(true);
            } else {
              onAddTask(phase.id);
            }
          }}
          className="rounded-md p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          aria-label={`Add task to ${phase.name}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 space-y-2 min-h-[100px] max-h-[calc(100vh-220px)]"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {phase.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task.id)}
            />
          ))}
        </SortableContext>

        {phase.tasks.length === 0 && !isCreating && (
          <div className="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-sm text-zinc-400">
            No tasks
          </div>
        )}

        {isCreating && onInlineCreate && (
          <InlineTaskInput
            onSubmit={async (title) => {
              await onInlineCreate(phase.id, title);
            }}
            onCancel={() => setIsCreating(false)}
          />
        )}
      </div>
    </div>
  );
}
