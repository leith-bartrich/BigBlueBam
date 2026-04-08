import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { KeyResultRow } from '@/components/goal/KeyResultRow';
import { Button } from '@/components/common/button';
import { Dialog } from '@/components/common/dialog';
import { Input } from '@/components/common/input';
import { useKeyResults, useCreateKeyResult, useUpdateKeyResult, type KeyResult, type MetricType } from '@/hooks/useKeyResults';

interface KeyResultListProps {
  goalId: string;
}

const metricTypes: Array<{ value: MetricType; label: string }> = [
  { value: 'number', label: 'Number' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'currency', label: 'Currency' },
  { value: 'boolean', label: 'Yes/No' },
];

export function KeyResultList({ goalId }: KeyResultListProps) {
  const { data, isLoading } = useKeyResults(goalId);
  const keyResults = data?.data ?? [];
  const createMutation = useCreateKeyResult();
  const updateMutation = useUpdateKeyResult();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKr, setEditingKr] = useState<KeyResult | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [metricType, setMetricType] = useState<MetricType>('number');
  const [startValue, setStartValue] = useState('0');
  const [targetValue, setTargetValue] = useState('100');
  const [unit, setUnit] = useState('');

  const resetForm = () => {
    setTitle('');
    setMetricType('number');
    setStartValue('0');
    setTargetValue('100');
    setUnit('');
    setEditingKr(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (kr: KeyResult) => {
    setEditingKr(kr);
    setTitle(kr.title);
    setMetricType(kr.metric_type);
    setStartValue(String(kr.start_value));
    setTargetValue(String(kr.target_value));
    setUnit(kr.unit ?? '');
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    if (editingKr) {
      updateMutation.mutate(
        {
          id: editingKr.id,
          goal_id: goalId,
          title: title.trim(),
          metric_type: metricType,
          start_value: Number(startValue),
          target_value: Number(targetValue),
          unit: unit.trim() || undefined,
        },
        { onSuccess: () => { setDialogOpen(false); resetForm(); } },
      );
    } else {
      createMutation.mutate(
        {
          goal_id: goalId,
          title: title.trim(),
          metric_type: metricType,
          start_value: Number(startValue),
          target_value: Number(targetValue),
          unit: unit.trim() || undefined,
        },
        { onSuccess: () => { setDialogOpen(false); resetForm(); } },
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
          Key Results ({keyResults.length})
        </h3>
        <Button size="sm" variant="secondary" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Add Key Result
        </Button>
      </div>

      {keyResults.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 py-8 text-center">
          <p className="text-sm text-zinc-500">No key results yet</p>
          <Button size="sm" className="mt-3" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add First Key Result
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {keyResults.map((kr) => (
            <KeyResultRow key={kr.id} kr={kr} goalId={goalId} onEdit={openEdit} />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingKr ? 'Edit Key Result' : 'Add Key Result'}
        description="Define a measurable outcome for this goal."
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g., Increase monthly active users"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Metric Type</label>
            <div className="flex gap-2">
              {metricTypes.map((mt) => (
                <button
                  key={mt.value}
                  onClick={() => setMetricType(mt.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    metricType === mt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  {mt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Value"
              type="number"
              value={startValue}
              onChange={(e) => setStartValue(e.target.value)}
            />
            <Input
              label="Target Value"
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
          </div>

          {(metricType === 'number' || metricType === 'currency') && (
            <Input
              label="Unit (optional)"
              placeholder="e.g., users, $, EUR"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!title.trim()}
            >
              {editingKr ? 'Save Changes' : 'Add Key Result'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
