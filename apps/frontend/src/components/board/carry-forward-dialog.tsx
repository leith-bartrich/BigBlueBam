import { useState, useMemo } from 'react';
import { RotateCcw, Archive, XCircle } from 'lucide-react';
import type { Task, Sprint } from '@bigbluebam/shared';
import { Dialog } from '@/components/common/dialog';
import { Button } from '@/components/common/button';
import { Select } from '@/components/common/select';
import { Avatar } from '@/components/common/avatar';
import { Badge } from '@/components/common/badge';
import { cn, priorityColor } from '@/lib/utils';
import { api } from '@/lib/api';

type CarryAction = 'carry_forward' | 'backlog' | 'cancel';

interface TaskDecision {
  taskId: string;
  action: CarryAction;
}

interface CarryForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint: Sprint;
  incompleteTasks: (Task & {
    human_id?: string;
    assignee?: { display_name: string; avatar_url: string | null } | null;
    state_name?: string;
  })[];
  plannedSprints: Sprint[];
  onComplete: () => void;
}

const ACTION_OPTIONS: { value: CarryAction; label: string }[] = [
  { value: 'carry_forward', label: 'Carry forward' },
  { value: 'backlog', label: 'Move to backlog' },
  { value: 'cancel', label: 'Cancel task' },
];

export function CarryForwardDialog({
  open,
  onOpenChange,
  sprint,
  incompleteTasks,
  plannedSprints,
  onComplete,
}: CarryForwardDialogProps) {
  const [decisions, setDecisions] = useState<Map<string, CarryAction>>(() => {
    const map = new Map<string, CarryAction>();
    for (const task of incompleteTasks) {
      map.set(task.id, 'carry_forward');
    }
    return map;
  });
  const [targetSprintId, setTargetSprintId] = useState<string>(
    plannedSprints[0]?.id ?? '',
  );
  const [retroNotes, setRetroNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sprintOptions = plannedSprints.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const summary = useMemo(() => {
    let carryCount = 0;
    let backlogCount = 0;
    let cancelCount = 0;
    for (const action of decisions.values()) {
      if (action === 'carry_forward') carryCount++;
      else if (action === 'backlog') backlogCount++;
      else cancelCount++;
    }
    return { carryCount, backlogCount, cancelCount };
  }, [decisions]);

  const setDecision = (taskId: string, action: CarryAction) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(taskId, action);
      return next;
    });
  };

  const setBulkAction = (action: CarryAction) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const taskId of next.keys()) {
        next.set(taskId, action);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const carryForwardData = incompleteTasks.map((task) => ({
        task_id: task.id,
        action: decisions.get(task.id) ?? 'carry_forward',
        target_sprint_id:
          decisions.get(task.id) === 'carry_forward' ? targetSprintId : undefined,
      }));

      await api.post(`/sprints/${sprint.id}/complete`, {
        carry_forward: carryForwardData,
        retrospective_notes: retroNotes || undefined,
      });

      onComplete();
      onOpenChange(false);
    } catch {
      // Error handling is done at the API layer (toast)
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Complete Sprint: ${sprint.name}`}
      description={`${incompleteTasks.length} incomplete task${incompleteTasks.length === 1 ? '' : 's'} need${incompleteTasks.length === 1 ? 's' : ''} a decision.`}
      className="max-w-3xl"
    >
      <div className="space-y-4 max-h-[60vh] flex flex-col">
        {/* Target sprint selector */}
        {plannedSprints.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Target sprint:
            </span>
            <Select
              options={sprintOptions}
              value={targetSprintId}
              onValueChange={setTargetSprintId}
              placeholder="Select sprint..."
              className="w-52"
            />
          </div>
        )}

        {/* Bulk actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-zinc-500">Bulk:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBulkAction('carry_forward')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Carry all forward
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBulkAction('backlog')}
          >
            <Archive className="h-3.5 w-3.5" />
            Move all to backlog
          </Button>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto space-y-1 border rounded-lg border-zinc-200 dark:border-zinc-800">
          {incompleteTasks.map((task) => {
            const action = decisions.get(task.id) ?? 'carry_forward';

            return (
              <div
                key={task.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 border-zinc-100 dark:border-zinc-800',
                  action === 'cancel' && 'opacity-50',
                )}
              >
                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-zinc-400">
                      {task.human_id ?? `#${task.task_number}`}
                    </span>
                    <Badge className={priorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                    {task.state_name && (
                      <Badge variant="default">{task.state_name}</Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {task.title}
                  </p>
                </div>

                {/* Assignee */}
                <div className="shrink-0">
                  {task.assignee ? (
                    <Avatar
                      src={task.assignee.avatar_url}
                      name={task.assignee.display_name}
                      size="sm"
                    />
                  ) : (
                    <span className="text-xs text-zinc-400">--</span>
                  )}
                </div>

                {/* Points */}
                <div className="w-10 shrink-0 text-center">
                  {task.story_points != null ? (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded bg-zinc-100 dark:bg-zinc-800 px-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {task.story_points}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">-</span>
                  )}
                </div>

                {/* Action selector */}
                <div className="shrink-0">
                  <Select
                    options={ACTION_OPTIONS}
                    value={action}
                    onValueChange={(val) => setDecision(task.id, val as CarryAction)}
                    className="w-40"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 text-xs text-zinc-500 shrink-0">
          <span className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3 text-primary-500" />
            {summary.carryCount} carry forward
          </span>
          <span className="flex items-center gap-1">
            <Archive className="h-3 w-3 text-yellow-500" />
            {summary.backlogCount} to backlog
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-500" />
            {summary.cancelCount} cancel
          </span>
        </div>

        {/* Retrospective notes */}
        <div className="shrink-0">
          <label
            htmlFor="retro-notes"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block"
          >
            Retrospective Notes (optional)
          </label>
          <textarea
            id="retro-notes"
            rows={3}
            value={retroNotes}
            onChange={(e) => setRetroNotes(e.target.value)}
            placeholder="What went well? What could be improved?"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 resize-y"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 shrink-0">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!targetSprintId && summary.carryCount > 0}
          >
            Complete Sprint
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
