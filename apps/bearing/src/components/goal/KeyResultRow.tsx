import { useState } from 'react';
import { Hash, Percent, DollarSign, ToggleLeft, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { ProgressBar } from '@/components/common/ProgressBar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/common/dropdown-menu';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { useSetKrValue, useDeleteKeyResult, type KeyResult, type MetricType } from '@/hooks/useKeyResults';

interface KeyResultRowProps {
  kr: KeyResult;
  goalId: string;
  onEdit: (kr: KeyResult) => void;
}

const metricIcons: Record<MetricType, typeof Hash> = {
  number: Hash,
  percentage: Percent,
  currency: DollarSign,
  boolean: ToggleLeft,
};

function formatMetricValue(value: number, type: MetricType, unit: string | null): string {
  switch (type) {
    case 'percentage':
      return `${Math.round(value)}%`;
    case 'currency':
      return `${unit ?? '$'}${value.toLocaleString()}`;
    case 'boolean':
      return value >= 1 ? 'Yes' : 'No';
    default:
      return unit ? `${value.toLocaleString()} ${unit}` : value.toLocaleString();
  }
}

export function KeyResultRow({ kr, goalId, onEdit }: KeyResultRowProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [newValue, setNewValue] = useState(String(kr.current_value));
  const setValueMutation = useSetKrValue();
  const deleteMutation = useDeleteKeyResult();

  const MetricIcon = metricIcons[kr.metric_type];

  const handleSubmitValue = () => {
    const parsed = Number(newValue);
    if (Number.isNaN(parsed)) return;
    setValueMutation.mutate(
      { id: kr.id, goalId, value: parsed },
      { onSuccess: () => setIsUpdating(false) },
    );
  };

  const handleDelete = () => {
    if (window.confirm(`Delete key result "${kr.title}"?`)) {
      deleteMutation.mutate({ id: kr.id, goalId });
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 p-4 group">
      {/* Metric icon */}
      <div className="flex items-center justify-center h-8 w-8 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0">
        <MetricIcon className="h-4 w-4 text-zinc-500" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{kr.title}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <ProgressBar value={kr.progress} size="sm" className="flex-1 max-w-[180px]" />
          <span className="text-xs text-zinc-500 whitespace-nowrap">
            {formatMetricValue(kr.current_value, kr.metric_type, kr.unit)}
            {' / '}
            {formatMetricValue(kr.target_value, kr.metric_type, kr.unit)}
          </span>
        </div>
      </div>

      {/* Inline value update */}
      {isUpdating ? (
        <div className="flex items-center gap-2 shrink-0">
          <Input
            type="number"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-24"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitValue();
              if (e.key === 'Escape') setIsUpdating(false);
            }}
            autoFocus
          />
          <Button size="sm" onClick={handleSubmitValue} loading={setValueMutation.isPending}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsUpdating(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="secondary" onClick={() => { setNewValue(String(kr.current_value)); setIsUpdating(true); }}>
            Update
          </Button>
          <DropdownMenu
            trigger={
              <button
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            }
          >
            <DropdownMenuItem onSelect={() => onEdit(kr)}>
              <Pencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={handleDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
