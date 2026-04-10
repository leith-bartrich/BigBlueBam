import type { BoltAction, ErrorPolicy } from '@/hooks/use-automations';
import { useActionCatalog, type ActionParameter } from '@/hooks/use-event-catalog';
import { X, Plus, GripVertical } from 'lucide-react';
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
  bam: 'Bam',
  banter: 'Banter',
  beacon: 'Beacon',
  brief: 'Brief',
  helpdesk: 'Helpdesk',
  bond: 'Bond',
  blast: 'Blast',
  board: 'Board',
  bearing: 'Bearing',
  bill: 'Bill',
  book: 'Book',
  blank: 'Blank',
  bench: 'Bench',
  system: 'System',
};

function placeholderForParam(param: ActionParameter): string {
  if (param.format === 'uuid') return 'UUID, e.g. {{ task.id }}';
  if (param.format === 'email') return 'someone@example.com';
  if (param.format === 'url') return 'https://...';
  if (param.format === 'datetime') return 'ISO 8601 datetime';
  if (param.format === 'string[]') return 'comma-separated, or {{ list }}';
  if (param.format === 'uuid[]') return 'comma-separated UUIDs';
  if (param.type === 'number') return 'number, or {{ value }}';
  if (param.type === 'boolean') return 'true / false';
  if (param.type === 'object') return '{ "key": "value" }';
  return 'value or {{ template }}';
}

export function ActionEditor({ action, index, onChange, onRemove }: ActionEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { data: actionsResponse } = useActionCatalog();
  const availableActions = actionsResponse?.data ?? [];

  // Group actions by source for the dropdown
  const groupedActions = useMemo(() => {
    const groups: Record<string, typeof availableActions> = {};
    for (const a of availableActions) {
      const src = a.source ?? 'other';
      if (!groups[src]) groups[src] = [];
      groups[src].push(a);
    }
    return groups;
  }, [availableActions]);

  const selectedAction = availableActions.find((a) => a.mcp_tool === action.mcp_tool);
  const schemaParams = selectedAction?.parameters ?? [];

  // Required parameters are always shown; optional parameters can be added on demand.
  const visibleParamNames = useMemo(() => {
    const set = new Set<string>(schemaParams.filter((p) => p.required).map((p) => p.name));
    for (const k of Object.keys(action.parameters)) set.add(k);
    return set;
  }, [schemaParams, action.parameters]);

  const orderedVisibleParams = useMemo(() => {
    // Render schema params first (in declaration order), then any extras
    // (e.g. legacy free-form params from older automations).
    const fromSchema = schemaParams.filter((p) => visibleParamNames.has(p.name));
    const extras = Object.keys(action.parameters)
      .filter((k) => !schemaParams.some((p) => p.name === k))
      .map<ActionParameter>((k) => ({
        name: k,
        type: 'string',
        required: false,
        nullable: false,
        description: 'Custom parameter',
      }));
    return [...fromSchema, ...extras];
  }, [schemaParams, visibleParamNames, action.parameters]);

  const optionalUnused = schemaParams.filter(
    (p) => !p.required && !visibleParamNames.has(p.name),
  );

  const setParameterValue = (name: string, value: string) => {
    onChange({
      ...action,
      parameters: { ...action.parameters, [name]: value },
    });
  };

  const removeParameter = (name: string) => {
    const next = { ...action.parameters };
    delete next[name];
    onChange({ ...action, parameters: next });
  };

  const addOptionalParameter = (name: string) => {
    onChange({
      ...action,
      parameters: { ...action.parameters, [name]: '' },
    });
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

        {!selectedAction && (
          <p className="text-xs text-zinc-400 italic">Pick an action above to see its parameters.</p>
        )}

        {selectedAction && orderedVisibleParams.length === 0 && (
          <p className="text-xs text-zinc-400 italic">This action takes no parameters.</p>
        )}

        {orderedVisibleParams.map((param) => {
          const value = action.parameters[param.name];
          const isEnum = param.type === 'enum' && param.enum && param.enum.length > 0;
          const isBoolean = param.type === 'boolean';

          return (
            <div key={param.name} className="flex items-start gap-2">
              <div className="w-44 shrink-0 pt-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300 truncate" title={param.name}>
                    {param.name}
                  </span>
                  {param.required && (
                    <span className="text-red-500 text-xs" title="Required">*</span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-400 truncate" title={param.description}>
                  {param.format ?? param.type}
                  {param.nullable ? ' • nullable' : ''}
                </div>
              </div>

              {isEnum ? (
                <select
                  value={String(value ?? '')}
                  onChange={(e) => setParameterValue(param.name, e.target.value)}
                  className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                >
                  <option value="">— select —</option>
                  {param.enum!.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : isBoolean ? (
                <select
                  value={String(value ?? '')}
                  onChange={(e) => setParameterValue(param.name, e.target.value)}
                  className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                >
                  <option value="">— select —</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={placeholderForParam(param)}
                  value={String(value ?? '')}
                  onChange={(e) => setParameterValue(param.name, e.target.value)}
                  title={param.description}
                  className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                />
              )}

              {!param.required && (
                <button
                  type="button"
                  onClick={() => removeParameter(param.name)}
                  className="shrink-0 p-1.5 rounded text-zinc-400 hover:text-red-500 transition-colors"
                  title="Remove this optional parameter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {optionalUnused.length > 0 && (
          <div className="pt-1">
            <details className="text-xs">
              <summary className="cursor-pointer text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 inline-flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" />
                Add optional parameter ({optionalUnused.length} available)
              </summary>
              <div className="mt-2 ml-4 flex flex-wrap gap-1.5">
                {optionalUnused.map((param) => (
                  <button
                    key={param.name}
                    type="button"
                    onClick={() => addOptionalParameter(param.name)}
                    title={param.description}
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 hover:border-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
                  >
                    {param.name}
                  </button>
                ))}
              </div>
            </details>
          </div>
        )}
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
