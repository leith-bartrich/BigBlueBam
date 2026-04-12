import { useCallback } from 'react';
import { useGraphEditorStore } from '@/stores/graph-editor.store';

// ─── Operator catalog (mirrors condition-row.tsx ALL_OPERATORS, using the
//     graph-level naming convention from bolt-graph.ts) ──────────────────────

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'gte', label: 'greater or equal' },
  { value: 'lte', label: 'less or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'in', label: 'in' },
  { value: 'not_in', label: 'not in' },
  { value: 'exists', label: 'exists' },
  { value: 'not_exists', label: 'not exists' },
] as const;

// ─── Props ──────────────────────────────────────────────────────────────────

interface ConditionPanelProps {
  nodeId: string;
  field: string;
  operator: string;
  value: unknown;
  logicGroup: 'and' | 'or';
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ConditionPanel({
  nodeId,
  field,
  operator,
  value,
  logicGroup,
}: ConditionPanelProps) {
  const updateNodeData = useGraphEditorStore((s) => s.updateNodeData);

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      updateNodeData(nodeId, patch);
    },
    [nodeId, updateNodeData],
  );

  const noValueOperator = operator === 'exists' || operator === 'not_exists';

  return (
    <div className="space-y-4">
      {/* Field */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Field
        </label>
        <input
          type="text"
          value={field}
          onChange={(e) => update({ field: e.target.value })}
          placeholder="event.task.priority"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
        />
        <p className="text-xs text-zinc-400">
          Dot-path to the field in the event payload, e.g. event.task.status
        </p>
      </div>

      {/* Operator */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Operator
        </label>
        <select
          value={operator}
          onChange={(e) => update({ operator: e.target.value })}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
        >
          {OPERATORS.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Value (hidden for exists/not_exists) */}
      {!noValueOperator && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Value
          </label>
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => update({ value: e.target.value })}
            placeholder="value or {{ template }}"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
          />
        </div>
      )}

      {/* Logic group toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Logic Group
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update({ logicGroup: 'and' })}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              logicGroup === 'and'
                ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
                : 'bg-white text-zinc-600 border border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
          >
            AND
          </button>
          <button
            type="button"
            onClick={() => update({ logicGroup: 'or' })}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              logicGroup === 'or'
                ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
                : 'bg-white text-zinc-600 border border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
          >
            OR
          </button>
        </div>
        <p className="text-xs text-zinc-400">
          How this condition combines with sibling conditions on the same branch.
        </p>
      </div>
    </div>
  );
}
