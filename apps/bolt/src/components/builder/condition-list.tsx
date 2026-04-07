import type { BoltCondition } from '@/hooks/use-automations';
import { ConditionRow } from '@/components/builder/condition-row';
import { Plus, Filter } from 'lucide-react';

interface ConditionListProps {
  conditions: BoltCondition[];
  onChange: (conditions: BoltCondition[]) => void;
}

function makeId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

export function ConditionList({ conditions, onChange }: ConditionListProps) {
  const addCondition = () => {
    onChange([
      ...conditions,
      {
        id: makeId(),
        field: '',
        operator: 'equals',
        value: '',
        logic_group: 'and',
        sort_order: conditions.length,
      },
    ]);
  };

  const updateCondition = (index: number, updated: BoltCondition) => {
    const next = [...conditions];
    next[index] = updated;
    onChange(next);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {conditions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-zinc-400">
          <Filter className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No conditions — automation will run on every matching trigger.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <ConditionRow
              key={condition.id}
              condition={condition}
              isFirst={index === 0}
              onChange={(updated) => updateCondition(index, updated)}
              onRemove={() => removeCondition(index)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addCondition}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Condition
      </button>
    </div>
  );
}
