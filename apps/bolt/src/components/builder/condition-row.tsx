import { useMemo } from 'react';
import type { BoltCondition, ConditionOperator, TriggerSource } from '@/hooks/use-automations';
import { FieldPicker } from '@/components/builder/field-picker';
import { ConditionValueInput } from '@/components/builder/condition-value-input';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { X } from 'lucide-react';

interface ConditionRowProps {
  condition: BoltCondition;
  isFirst: boolean;
  onChange: (updated: BoltCondition) => void;
  onRemove: () => void;
  triggerSource?: TriggerSource;
  triggerEvent?: string;
}

// ─── Operator definitions ─────────────────────────────────────────────────────

type OperatorDef = { value: ConditionOperator; label: string };

const ALL_OPERATORS: OperatorDef[] = [
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

/** A2: filter operators by resolved field type */
function getValidOperators(fieldType?: string): OperatorDef[] {
  if (!fieldType) return ALL_OPERATORS;
  switch (fieldType) {
    case 'string':
      return ALL_OPERATORS.filter((op) =>
        ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with',
          'matches_regex', 'is_empty', 'is_not_empty', 'in', 'not_in'].includes(op.value),
      );
    case 'number':
    case 'date':
      return ALL_OPERATORS.filter((op) =>
        ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty',
          'in', 'not_in'].includes(op.value),
      );
    case 'boolean':
      return ALL_OPERATORS.filter((op) =>
        ['equals', 'not_equals', 'is_empty', 'is_not_empty'].includes(op.value),
      );
    case 'enum':
      return ALL_OPERATORS.filter((op) =>
        ['equals', 'not_equals', 'is_empty', 'is_not_empty', 'in', 'not_in'].includes(op.value),
      );
    default:
      return ALL_OPERATORS;
  }
}

// ─── Field schema resolver ────────────────────────────────────────────────────

/** Look up a condition field path against the event catalog. Returns {type, enum} or undefined. */
function useFieldSchema(
  fieldPath: string,
  triggerSource?: TriggerSource,
  triggerEvent?: string,
): { fieldType: string | undefined; fieldEnum: string[] | undefined } {
  const { data } = useEventCatalog();
  return useMemo(() => {
    if (!fieldPath || !data?.data) return { fieldType: undefined, fieldEnum: undefined };
    const allEvents = data.data;

    // Narrow to the selected event if possible, otherwise check all source events
    const candidates = triggerSource
      ? allEvents.filter((e) => {
          if (triggerEvent) return e.source === triggerSource && e.event_type === triggerEvent;
          return e.source === triggerSource;
        })
      : allEvents;

    // condition field paths use "event.task.priority" style — strip the "event." prefix
    // to match payload_schema names, but also check "actor.*" directly
    const normalised = fieldPath.startsWith('event.') ? fieldPath.slice('event.'.length) : fieldPath;

    for (const evt of candidates) {
      const found = evt.payload_schema.find((f) => f.name === normalised || `event.${f.name}` === fieldPath);
      if (found) {
        return { fieldType: found.type, fieldEnum: found.enum };
      }
    }
    return { fieldType: undefined, fieldEnum: undefined };
  }, [data, fieldPath, triggerSource, triggerEvent]);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConditionRow({ condition, isFirst, onChange, onRemove, triggerSource, triggerEvent }: ConditionRowProps) {
  const { fieldType, fieldEnum } = useFieldSchema(condition.field, triggerSource, triggerEvent);

  const validOperators = useMemo(() => getValidOperators(fieldType), [fieldType]);

  // A2: when field type changes the current operator may become invalid — reset to 'equals'
  const safeOperator = useMemo((): ConditionOperator => {
    const valid = validOperators.map((op) => op.value);
    return valid.includes(condition.operator) ? condition.operator : 'equals';
  }, [validOperators, condition.operator]);

  const handleFieldChange = (newField: string) => {
    onChange({ ...condition, field: newField });
  };

  const handleOperatorChange = (newOp: ConditionOperator) => {
    onChange({ ...condition, operator: newOp });
  };

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
          onChange={handleFieldChange}
          triggerSource={triggerSource}
          triggerEvent={triggerEvent}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 pr-8"
        />
      </div>

      {/* Operator (A2: filtered by fieldType) */}
      <select
        value={safeOperator}
        onChange={(e) => handleOperatorChange(e.target.value as ConditionOperator)}
        className="w-40 shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
      >
        {validOperators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value (A1: type-aware) */}
      <div className="flex-1 min-w-0">
        <ConditionValueInput
          operator={safeOperator}
          fieldType={fieldType}
          fieldEnum={fieldEnum}
          value={condition.value}
          onChange={(v) => onChange({ ...condition, value: v })}
          triggerSource={triggerSource}
          triggerEvent={triggerEvent}
        />
      </div>

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
