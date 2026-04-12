import { Zap, GitBranch, Play, X } from 'lucide-react';
import { useGraphEditorStore } from '@/stores/graph-editor.store';
import { TriggerPanel } from '@/components/graph/panels/trigger-panel';
import { ConditionPanel } from '@/components/graph/panels/condition-panel';
import { ActionPanel } from '@/components/graph/panels/action-panel';

// ─── Kind metadata ──────────────────────────────────────────────────────────

const KIND_META: Record<string, { label: string; color: string; bgColor: string; Icon: typeof Zap }> = {
  trigger: {
    label: 'Trigger',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    Icon: Zap,
  },
  condition: {
    label: 'Condition',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    Icon: GitBranch,
  },
  action: {
    label: 'Action',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    Icon: Play,
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function NodeInspector() {
  const selectedNodeId = useGraphEditorStore((s) => s.selectedNodeId);
  const nodes = useGraphEditorStore((s) => s.nodes);
  const selectNode = useGraphEditorStore((s) => s.selectNode);

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;

  const kind = selectedNode?.data?.kind as string | undefined;
  const meta = kind ? KIND_META[kind] : undefined;

  return (
    <div className="w-80 h-full border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex flex-col shrink-0">
      {/* Empty state */}
      {!selectedNode && (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-zinc-400 text-center">
            Select a node on the canvas to configure it.
          </p>
        </div>
      )}

      {/* Inspector content */}
      {selectedNode && meta && (
        <>
          {/* Header */}
          <div className={`flex items-center gap-2 px-4 py-3 border-b ${meta.bgColor}`}>
            <meta.Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
            <span className={`text-sm font-semibold ${meta.color}`}>
              {meta.label}
            </span>
            <button
              type="button"
              onClick={() => selectNode(null)}
              className="ml-auto shrink-0 p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Close inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {kind === 'trigger' && (
              <TriggerPanel
                nodeId={selectedNode.id}
                source={String(selectedNode.data.source ?? '')}
                event={String(selectedNode.data.event ?? '')}
                filter={(selectedNode.data.filter as Record<string, unknown>) ?? {}}
              />
            )}

            {kind === 'condition' && (
              <ConditionPanel
                nodeId={selectedNode.id}
                field={String(selectedNode.data.field ?? '')}
                operator={String(selectedNode.data.operator ?? 'eq')}
                value={selectedNode.data.value}
                logicGroup={(selectedNode.data.logicGroup as 'and' | 'or') ?? 'and'}
              />
            )}

            {kind === 'action' && (
              <ActionPanel
                nodeId={selectedNode.id}
                mcpTool={String(selectedNode.data.mcpTool ?? '')}
                parameters={(selectedNode.data.parameters as Record<string, unknown>) ?? {}}
                onError={String(selectedNode.data.onError ?? 'fail')}
                retryCount={Number(selectedNode.data.retryCount ?? 0)}
                retryDelayMs={Number(selectedNode.data.retryDelayMs ?? 1000)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
