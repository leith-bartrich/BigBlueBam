import type { BoltCondition, ConditionOperator } from '@/hooks/use-automations';
import { FieldPicker } from '@/components/builder/field-picker';
import { X } from 'lucide-react';

interface ConditionRowProps {
  condition: BoltCondition;
  isFirst: boolean;
  onChange: (updated: BoltCondition) => void;
  onRemove: () => void;
  triggerSource?: string;
  triggerEvent?: string;
}

const operators: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'in', label: 'in' },
  { value: 'not_in', label: 'not in' },
  { value: 'matches_regex', label: 'matches regex' },
];

const noValueOperators = new Set<ConditionOperator>(['is_empty', 'is_not_empty']);

export function ConditionRow({ condition, isFirst, onChange, onRemove, triggerSource, triggerEvent }: ConditionRowProps) {
  return (
    <div className="flex items-start gap-2">
      {/* Logic group toggle */}
      <div className="w-16 shrink-0 pt-2">
        {isFirst ? (
          <span className="text-xs font-medium text-zinc-400 uppercase">Where</span>
        ) : (
          <button
            type="button"
            onClick={() =>
              onChange({ ...condition, logic_group: condition.logic_group === 'and' ? 'or' : 'and' })
            }
            className="text-xs font-semibold uppercase rounded px-2 py-1 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors"
          >
            {condition.logic_group}
          </button>
        )}
      </div>

      {/* Field */}
      <div className="flex-1 min-w-0">
        <FieldPicker
          value={condition.field}
          onChange={(v) => onChange({ ...condition, field: v })}
          triggerSource={triggerSource}
          triggerEvent={triggerEvent}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 pr-8"
        />
      </div>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as ConditionOperator })}
        className="w-40 shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value */}
      {!noValueOperators.has(condition.operator) && (
        <input
          type="text"
          placeholder="value"
          value={String(condition.value ?? '')}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="flex-1 min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
        />
      )}

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        title="Remove condition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
