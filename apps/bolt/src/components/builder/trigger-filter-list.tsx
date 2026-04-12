import { useState, useCallback } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import { ConditionRow } from '@/components/builder/condition-row';
import type { BoltCondition, TriggerSource } from '@/hooks/use-automations';

// ─── Props ───────────────────────────────────────────────────────────────────

interface TriggerFilterListProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  triggerSource?: TriggerSource;
  triggerEvent?: string;
}

// ─── Helpers — freeform ↔ rows conversion ────────────────────────────────────

/** A simple (string) value: can be stored as key: value in the freeform record. */
function isSimpleValue(v: unknown): boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null;
}

interface FilterRow {
  id: string;
  key: string;
  /** Simple scalar value — stored directly */
  simpleValue: unknown;
  /** Complex value (object/array) — rendered read-only */
  complex: boolean;
  rawJson: string;
}

let _idCounter = 0;
function nextId() {
  return `tfl-${++_idCounter}`;
}

function freeformToRows(filter: Record<string, unknown>): FilterRow[] {
  return Object.entries(filter).map(([key, val]) => {
    const complex = !isSimpleValue(val);
    return {
      id: nextId(),
      key,
      simpleValue: complex ? '' : val,
      complex,
      rawJson: complex ? JSON.stringify(val, null, 2) : '',
    };
  });
}

function rowsToFreeform(rows: FilterRow[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row.key) continue; // skip empty-key rows
    if (row.complex) {
      try {
        result[row.key] = JSON.parse(row.rawJson);
      } catch {
        result[row.key] = row.rawJson; // preserve as string if invalid JSON
      }
    } else {
      result[row.key] = row.simpleValue;
    }
  }
  return result;
}

/** Convert a FilterRow to a BoltCondition for rendering via ConditionRow. */
function rowToCondition(row: FilterRow): BoltCondition {
  return {
    id: row.id,
    field: row.key,
    operator: 'equals', // A3: freeform storage only supports equality
    value: row.simpleValue,
    logic_group: 'and',
    sort_order: 0,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TriggerFilterList({
  value,
  onChange,
  triggerSource,
  triggerEvent,
}: TriggerFilterListProps) {
  const [rows, setRows] = useState<FilterRow[]>(() => freeformToRows(value));

  const commit = useCallback(
    (nextRows: FilterRow[]) => {
      setRows(nextRows);
      onChange(rowsToFreeform(nextRows));
    },
    [onChange],
  );

  const handleConditionChange = (rowId: string, updated: BoltCondition) => {
    commit(
      rows.map((r) =>
        r.id === rowId
          ? { ...r, key: updated.field, simpleValue: updated.value }
          : r,
      ),
    );
  };

  const handleRemove = (rowId: string) => {
    commit(rows.filter((r) => r.id !== rowId));
  };

  const handleAdd = () => {
    commit([...rows, { id: nextId(), key: '', simpleValue: '', complex: false, rawJson: '' }]);
  };

  const handleComplexJsonChange = (rowId: string, rawJson: string) => {
    commit(rows.map((r) => (r.id === rowId ? { ...r, rawJson } : r)));
  };

  return (
    <div className="space-y-2 mt-2">
      {rows.length === 0 && (
        <p className="text-xs text-zinc-400 italic">No filter rules. All events matching the trigger will run the automation.</p>
      )}

      {rows.map((row, index) => {
        // Complex values — render as read-only chip with JSON escape hatch
        if (row.complex) {
          return (
            <div key={row.id} className="rounded-lg border border-amber-200 dark:border-amber-800/40 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Complex filter: <code className="font-mono">{row.key}</code>
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    This filter uses a complex expression; edit as JSON to modify.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(row.id)}
                  className="text-xs text-red-500 hover:text-red-600 shrink-0"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={row.rawJson}
                onChange={(e) => handleComplexJsonChange(row.id, e.target.value)}
                rows={3}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                placeholder="Edit JSON value..."
              />
            </div>
          );
        }

        // Simple values — use ConditionRow (inherits A1 type-aware picker + A2 operator filtering)
        // Operator is locked to 'equals' for the freeform storage model
        return (
          <div key={row.id} className="relative">
            <ConditionRow
              condition={rowToCondition(row)}
              isFirst={index === 0}
              onChange={(updated) => handleConditionChange(row.id, updated)}
              onRemove={() => handleRemove(row.id)}
              triggerSource={triggerSource}
              triggerEvent={triggerEvent}
              lockOperator
            />
          </div>
        );
      })}

      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add filter rule
      </button>
    </div>
  );
}
