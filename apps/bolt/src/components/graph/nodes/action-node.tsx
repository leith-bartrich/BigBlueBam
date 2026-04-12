import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import type { ActionNodeData } from '@/types/bolt-graph';

type ActionNodeDataWithKind = ActionNodeData & { kind: 'action' } & Record<string, unknown>;
type ActionNode = Node<ActionNodeDataWithKind, 'action-node'>;

function ActionNodeComponent({ data, selected }: NodeProps<ActionNode>) {
  const paramCount = Object.keys(data.parameters ?? {}).length;

  let errorBadge: string | null = null;
  if (data.onError === 'retry') {
    errorBadge = `retry \u00d7${data.retryCount ?? 0}`;
  } else if (data.onError === 'continue') {
    errorBadge = 'continue';
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Action: ${data.mcpTool || 'Not configured'}`}
      className={`group w-[180px] rounded-lg border bg-green-50 dark:bg-green-900/20 ${
        selected
          ? 'ring-2 ring-green-500 border-green-400 dark:border-green-500'
          : 'border-green-200 dark:border-green-800/50'
      }`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        className="!h-2.5 !w-2.5 !border-2 !border-green-400 !bg-green-100 dark:!border-green-500 dark:!bg-green-900"
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 rounded-t-lg bg-green-100 px-2.5 py-1.5 dark:bg-green-900/40">
        <Play className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
          Action
        </span>
      </div>

      {/* Body */}
      <div className="px-2.5 py-2">
        <p className="truncate text-sm font-medium text-green-900 dark:text-green-100">
          {data.mcpTool || 'Not configured'}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {paramCount > 0 && (
            <span className="inline-block rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-800/50 dark:text-green-300">
              {paramCount} {paramCount === 1 ? 'param' : 'params'}
            </span>
          )}
          {errorBadge && (
            <span className="inline-block rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-800/50 dark:text-green-300">
              {errorBadge}
            </span>
          )}
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="!h-2.5 !w-2.5 !border-2 !border-green-400 !bg-green-100 dark:!border-green-500 dark:!bg-green-900"
      />
    </div>
  );
}

export const ActionNode = memo(ActionNodeComponent);
