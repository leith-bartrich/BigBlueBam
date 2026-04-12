import { useCallback, useMemo, useEffect } from 'react';
import { useGraphEditorStore } from '@/stores/graph-editor.store';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { FieldPicker } from '@/components/builder/field-picker';
import { ConditionValueInput } from '@/components/builder/condition-value-input';
import type { TriggerSource, ConditionOperator } from '@/hooks/use-automations';

// ─── Operator catalog ─────────────────────────────────────────────────────────
//
// These MUST match the `boltConditionOperatorEnum` in apps/bolt-api/src/db/
// schema/bolt-conditions.ts exactly — the graph compiler casts the operator
// directly to the DB row type without translation, so any deviation produces
// an enum-violation error on save. Mirrors ALL_OPERATORS in condition-row.tsx.

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

/** Filter operators by resolved field type. Mirrors condition-row.tsx. */
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
  const nodes = useGraphEditorStore((s) => s.nodes);
  const { data: catalog } = useEventCatalog();

  // Resolve the graph's trigger source/event from the trigger node
  const { triggerSource, triggerEvent } = useMemo(() => {
    const triggerNode = nodes.find((n) => n.data?.kind === 'trigger');
    if (!triggerNode) return { triggerSource: undefined, triggerEvent: undefined };
    const data = triggerNode.data as Record<string, unknown>;
    return {
      triggerSource: data.source as TriggerSource | undefined,
      triggerEvent: data.event as string | undefined,
    };
  }, [nodes]);

  // Look up the field's type/enum from the event catalog
  const { fieldType, fieldEnum } = useMemo((): {
    fieldType: string | undefined;
    fieldEnum: string[] | undefined;
  } => {
    if (!field || !catalog?.data) return { fieldType: undefined, fieldEnum: undefined };
    const allEvents = catalog.data;
    const candidates = triggerSource
      ? allEvents.filter((e) => {
          if (triggerEvent) return e.source === triggerSource && e.event_type === triggerEvent;
          return e.source === triggerSource;
        })
      : allEvents;

    const normalised = field.startsWith('event.') ? field.slice('event.'.length) : field;
    for (const evt of candidates) {
      const found = evt.payload_schema.find((f) => f.name === normalised || `event.${f.name}` === field);
      if (found) return { fieldType: found.type, fieldEnum: found.enum };
    }
    return { fieldType: undefined, fieldEnum: undefined };
  }, [catalog, field, triggerSource, triggerEvent]);

  const validOperators = useMemo(() => getValidOperators(fieldType), [fieldType]);

  // If the current operator is no longer valid for the (possibly updated) field
  // type, silently reset to 'equals'.
  const safeOperator = useMemo((): ConditionOperator => {
    const valid = validOperators.map((op) => op.value);
    const isValid = valid.includes(operator as ConditionOperator);
    return isValid ? (operator as ConditionOperator) : 'equals';
  }, [validOperators, operator]);

  useEffect(() => {
    if (safeOperator !== operator) {
      updateNodeData(nodeId, { operator: safeOperator });
    }
  }, [safeOperator, operator, nodeId, updateNodeData]);

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      updateNodeData(nodeId, patch);
    },
    [nodeId, updateNodeData],
  );

  const noValueOperator = safeOperator === 'is_empty' || safeOperator === 'is_not_empty';

  return (
    <div className="space-y-4">
      {/* Field (with autocomplete from event catalog) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Field
        </label>
        <FieldPicker
          value={field}
          onChange={(newField) => update({ field: newField })}
          triggerSource={triggerSource}
          triggerEvent={triggerEvent}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 pr-8"
        />
        <p className="text-xs text-zinc-400">
          Dot-path to the field in the event payload, e.g. event.task.status
        </p>
      </div>

      {/* Operator (filtered by field type) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Operator
        </label>
        <select
          value={safeOperator}
          onChange={(e) => update({ operator: e.target.value })}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
        >
          {validOperators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Value — type-aware, reuses the simple editor's input which handles
          enum dropdowns, date pickers, number inputs, boolean radios, chip
          inputs for in/not_in, and template-expression mode. */}
      {!noValueOperator && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Value
          </label>
          <ConditionValueInput
            operator={safeOperator}
            fieldType={fieldType}
            fieldEnum={fieldEnum}
            value={value}
            onChange={(v) => update({ value: v })}
            triggerSource={triggerSource}
            triggerEvent={triggerEvent}
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
