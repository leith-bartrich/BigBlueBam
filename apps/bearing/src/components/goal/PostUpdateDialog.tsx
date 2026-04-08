import { useState } from 'react';
import { Dialog } from '@/components/common/dialog';
import { Button } from '@/components/common/button';
import { usePostUpdate, type GoalStatus } from '@/hooks/useGoals';
import { cn } from '@/lib/utils';

interface PostUpdateDialogProps {
  goalId: string;
  currentStatus: GoalStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions: Array<{ value: GoalStatus; label: string; color: string }> = [
  { value: 'on_track', label: 'On Track', color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  { value: 'at_risk', label: 'At Risk', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' },
  { value: 'behind', label: 'Behind', color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
  { value: 'achieved', label: 'Achieved', color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' },
];

export function PostUpdateDialog({ goalId, currentStatus, open, onOpenChange }: PostUpdateDialogProps) {
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<GoalStatus>(currentStatus);
  const postMutation = usePostUpdate();

  const handleSubmit = () => {
    if (!body.trim()) return;
    postMutation.mutate(
      { goalId, body: body.trim(), status },
      {
        onSuccess: () => {
          setBody('');
          setStatus(currentStatus);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Post Status Update"
      description="Share progress with your team."
    >
      <div className="space-y-4">
        {/* Status selector */}
        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">Status</label>
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                  status === opt.value
                    ? opt.color
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">Update</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's the latest on this goal? Any blockers?"
            className={cn(
              'w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-zinc-100',
              'placeholder:text-zinc-400 min-h-[100px] resize-y',
            )}
            rows={4}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            loading={postMutation.isPending}
            disabled={!body.trim()}
          >
            Post Update
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
