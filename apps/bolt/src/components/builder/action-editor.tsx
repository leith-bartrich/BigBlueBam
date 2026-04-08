import type { BoltAction, ErrorPolicy } from '@/hooks/use-automations';
import { useActionCatalog } from '@/hooks/use-event-catalog';
import { X, Plus, GripVertical, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';

interface ActionEditorProps {
  action: BoltAction;
  index: number;
  onChange: (updated: BoltAction) => void;
  onRemove: () => void;
}

const errorPolicies: { value: ErrorPolicy; label: string; description: string }[] = [
  { value: 'stop', label: 'Stop', description: 'Stop the automation on error' },
  { value: 'continue', label: 'Continue', description: 'Skip this step and continue' },
  { value: 'retry', label: 'Retry', description: 'Retry this step before failing' },
];

const sourceLabels: Record<string, string> = {
  bam: 'Bam', banter: 'Banter', beacon: 'Beacon', brief: 'Brief', helpdesk: 'Helpdesk', system: 'System',
};

export function ActionEditor({ action, index, onChange, onRemove }: ActionEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { data: actionsResponse } = useActionCatalog();
  const availableActions = actionsResponse?.data ?? [];

  // Group actions by source for the dropdown
  const groupedActions = useMemo(() => {
    const groups: Record<string, typeof availableActions> = {};
    for (const a of availableActions) {
      const src = (a as any).source ?? 'other';
      if (!groups[src]) groups[src] = [];
      groups[src].push(a);
    }
    return groups;
  }, [availableActions]);

  const selectedAction = availableActions.find((a) => a.mcp_tool === action.mcp_tool);

  const params = Object.entries(action.parameters);

  const addParameter = () => {
    onChange({
      ...action,
      parameters: { ...action.parameters, '': '' },
    });
  };

  const updateParameterKey = (oldKey: string, newKey: string) => {
    const entries = Object.entries(action.parameters);
    const newParams: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      newParams[k === oldKey ? newKey : k] = v;
    }
    onChange({ ...action, parameters: newParams });
  };

  const updateParameterValue = (key: string, value: string) => {
    onChange({
      ...action,
      parameters: { ...action.parameters, [key]: value },
    });
  };

  const removeParameter = (key: string) => {
    const next = { ...action.parameters };
    delete next[key];
    onChange({ ...action, parameters: next });
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50/50 dark:bg-zinc-800/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <GripVertical className="h-4 w-4 text-zinc-400 cursor-grab shrink-0" />
        <span className="text-xs font-mono text-zinc-400 shrink-0">#{index + 1}</span>

        <select
          value={action.mcp_tool}
          onChange={(e) => onChange({ ...action, mcp_tool: e.target.value })}
          className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
        >
          <option value="">Select an action...</option>
          {Object.entries(groupedActions).map(([source, actions]) => (
            <optgroup key={source} label={sourceLabels[source] ?? source}>
              {actions.map((a) => (
                <option key={a.mcp_tool} value={a.mcp_tool}>
                  {a.description}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Remove action"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Selected action hint */}
      {selectedAction && (
        <div className="px-4 pt-2 text-xs text-green-600 dark:text-green-400">
          <span className="font-mono">{selectedAction.mcp_tool}</span> — {selectedAction.description}
        </div>
      )}

      {/* Parameters */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Parameters</label>
          <span className="text-[10px] text-zinc-400">
            Use {'{{ field }}'} for template variables
          </span>
        </div>

        {params.length === 0 && (
          <p className="text-xs text-zinc-400 italic">No parameters configured.</p>
        )}

        {params.map(([key, value], i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="key"
              value={key}
              onChange={(e) => updateParameterKey(key, e.target.value)}
              className="w-40 shrink-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
            />
            <input
              type="text"
              placeholder="value or {{ template }}"
              value={String(value ?? '')}
              onChange={(e) => updateParameterValue(key, e.target.value)}
              className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
            />
            <button
              type="button"
              onClick={() => removeParameter(key)}
              className="shrink-0 p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addParameter}
          className="inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Parameter
        </button>
      </div>

      {/* Advanced: error policy */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          {showAdvanced ? 'Hide advanced' : 'Show advanced'}
        </button>

        {showAdvanced && (
          <div className="mt-2 flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">On Error</label>
              <select
                value={action.on_error}
                onChange={(e) => onChange({ ...action, on_error: e.target.value as ErrorPolicy })}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
              >
                {errorPolicies.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {action.on_error === 'retry' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Retry Count</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={action.retry_count}
                  onChange={(e) => onChange({ ...action, retry_count: Number(e.target.value) || 1 })}
                  className="w-20 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
