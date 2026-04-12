import { useCallback, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useActionCatalog, type ActionParameter } from '@/hooks/use-event-catalog';
import { useGraphEditorStore } from '@/stores/graph-editor.store';

// ─── Error policies ─────────────────────────────────────────────────────────

const ERROR_POLICIES = [
  { value: 'fail', label: 'Fail', description: 'Stop the automation on error' },
  { value: 'continue', label: 'Continue', description: 'Skip this step and continue' },
  { value: 'retry', label: 'Retry', description: 'Retry before failing' },
] as const;

// ─── Grouped action labels (mirrors action-editor.tsx) ──────────────────────

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
  if (param.type === 'number') return 'number or {{ value }}';
  if (param.type === 'boolean') return 'true / false';
  if (param.type === 'object') return '{ "key": "value" }';
  return 'value or {{ template }}';
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface ActionPanelProps {
  nodeId: string;
  mcpTool: string;
  parameters: Record<string, unknown>;
  onError: string;
  retryCount: number;
  retryDelayMs: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ActionPanel({
  nodeId,
  mcpTool,
  parameters,
  onError,
  retryCount,
  retryDelayMs,
}: ActionPanelProps) {
  const updateNodeData = useGraphEditorStore((s) => s.updateNodeData);
  const { data: actionsResponse } = useActionCatalog();
  const availableActions = actionsResponse?.data ?? [];
  const [showRetry, setShowRetry] = useState(onError === 'retry');

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      updateNodeData(nodeId, patch);
    },
    [nodeId, updateNodeData],
  );

  // Group actions by source
  const groupedActions = useMemo(() => {
    const groups: Record<string, typeof availableActions> = {};
    for (const a of availableActions) {
      const src = a.source ?? 'other';
      if (!groups[src]) groups[src] = [];
      groups[src].push(a);
    }
    return groups;
  }, [availableActions]);

  const selectedAction = availableActions.find((a) => a.mcp_tool === mcpTool);
  const schemaParams = selectedAction?.parameters ?? [];

  // Visible params: all required + any already set in parameters
  const visibleParamNames = useMemo(() => {
    const set = new Set<string>(schemaParams.filter((p) => p.required).map((p) => p.name));
    for (const k of Object.keys(parameters)) set.add(k);
    return set;
  }, [schemaParams, parameters]);

  const orderedVisibleParams = useMemo(() => {
    const fromSchema = schemaParams.filter((p) => visibleParamNames.has(p.name));
    const extras = Object.keys(parameters)
      .filter((k) => !schemaParams.some((p) => p.name === k))
      .map<ActionParameter>((k) => ({
        name: k,
        type: 'string',
        required: false,
        nullable: false,
        description: 'Custom parameter',
      }));
    return [...fromSchema, ...extras];
  }, [schemaParams, visibleParamNames, parameters]);

  const optionalUnused = schemaParams.filter(
    (p) => !p.required && !visibleParamNames.has(p.name),
  );

  const setParam = (name: string, value: string) => {
    update({ parameters: { ...parameters, [name]: value } });
  };

  const removeParam = (name: string) => {
    const next = { ...parameters };
    delete next[name];
    update({ parameters: next });
  };

  const addOptionalParam = (name: string) => {
    update({ parameters: { ...parameters, [name]: '' } });
  };

  return (
    <div className="space-y-4">
      {/* MCP Tool picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Action
        </label>
        <select
          value={mcpTool}
          onChange={(e) => update({ mcpTool: e.target.value, parameters: {} })}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
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
        {selectedAction && (
          <p className="text-xs text-green-600 dark:text-green-400 font-mono">
            {selectedAction.mcp_tool}
          </p>
        )}
      </div>

      {/* Parameters */}
      {selectedAction && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Parameters
            </label>
            <span className="text-[10px] text-zinc-400">
              Use {'{{ field }}'} for templates
            </span>
          </div>

          {orderedVisibleParams.length === 0 && (
            <p className="text-xs text-zinc-400 italic">This action takes no parameters.</p>
          )}

          {orderedVisibleParams.map((param) => {
            const paramValue = parameters[param.name];
            const isEnum = param.type === 'enum' && param.enum && param.enum.length > 0;
            const isBoolean = param.type === 'boolean';

            return (
              <div key={param.name} className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate" title={param.name}>
                    {param.name}
                  </span>
                  {param.required && (
                    <span className="text-zinc-400 text-[10px]" title="Required">*</span>
                  )}
                  <span className="text-[10px] text-zinc-400 ml-auto">
                    {param.format ?? param.type}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isEnum ? (
                    <select
                      value={String(paramValue ?? '')}
                      onChange={(e) => setParam(param.name, e.target.value)}
                      className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                    >
                      <option value="">-- select --</option>
                      {param.enum!.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : isBoolean ? (
                    <select
                      value={String(paramValue ?? '')}
                      onChange={(e) => setParam(param.name, e.target.value)}
                      className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                    >
                      <option value="">-- select --</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={String(paramValue ?? '')}
                      onChange={(e) => setParam(param.name, e.target.value)}
                      placeholder={placeholderForParam(param)}
                      title={param.description}
                      className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                    />
                  )}

                  {!param.required && (
                    <button
                      type="button"
                      onClick={() => removeParam(param.name)}
                      className="shrink-0 p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"
                      title="Remove parameter"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {param.description && (
                  <p className="text-[10px] text-zinc-400 truncate" title={param.description}>
                    {param.description}
                  </p>
                )}
              </div>
            );
          })}

          {/* Add optional parameter */}
          {optionalUnused.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 inline-flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" />
                Add optional parameter ({optionalUnused.length})
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {optionalUnused.map((param) => (
                  <button
                    key={param.name}
                    type="button"
                    onClick={() => addOptionalParam(param.name)}
                    title={param.description}
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 hover:border-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
                  >
                    {param.name}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {!selectedAction && mcpTool === '' && (
        <p className="text-xs text-zinc-400 italic">Pick an action above to configure its parameters.</p>
      )}

      {/* Error policy */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-200 dark:border-zinc-700 pt-4">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          On Error
        </label>
        <select
          value={onError}
          onChange={(e) => {
            const next = e.target.value;
            update({ onError: next });
            setShowRetry(next === 'retry');
          }}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
        >
          {ERROR_POLICIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label} — {p.description}
            </option>
          ))}
        </select>
      </div>

      {/* Retry settings */}
      {(onError === 'retry' || showRetry) && (
        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Retry Count
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={retryCount}
              onChange={(e) => update({ retryCount: Number(e.target.value) || 1 })}
              className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Delay (ms)
            </label>
            <input
              type="number"
              min={100}
              max={60000}
              step={100}
              value={retryDelayMs}
              onChange={(e) => update({ retryDelayMs: Number(e.target.value) || 1000 })}
              className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}
