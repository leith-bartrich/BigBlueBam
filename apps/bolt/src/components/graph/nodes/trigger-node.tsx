import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import type { TriggerNodeData } from '@/types/bolt-graph';

type TriggerNodeDataWithKind = TriggerNodeData & { kind: 'trigger' } & Record<string, unknown>;
type TriggerNode = Node<TriggerNodeDataWithKind, 'trigger-node'>;

function TriggerNodeComponent({ data, selected }: NodeProps<TriggerNode>) {
  const filterCount = Object.keys(data.filter ?? {}).length;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Trigger node: ${data.source && data.event ? `${data.source} / ${data.event}` : 'Not configured'}`}
      className={`group w-[180px] rounded-lg border bg-blue-50 dark:bg-blue-900/20 ${
        selected
          ? 'ring-2 ring-blue-500 border-blue-400 dark:border-blue-500'
          : 'border-blue-200 dark:border-blue-800/50'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 rounded-t-lg bg-blue-100 px-2.5 py-1.5 dark:bg-blue-900/40">
        <Zap className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
          Trigger
        </span>
      </div>

      {/* Body */}
      <div className="px-2.5 py-2">
        <p className="truncate text-sm font-medium text-blue-900 dark:text-blue-100">
          {data.source && data.event
            ? `${data.source} / ${data.event}`
            : 'Not configured'}
        </p>
        {filterCount > 0 && (
          <span className="mt-1 inline-block rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-800/50 dark:text-blue-300">
            {filterCount} {filterCount === 1 ? 'filter' : 'filters'}
          </span>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="!h-2.5 !w-2.5 !border-2 !border-blue-400 !bg-blue-100 dark:!border-blue-500 dark:!bg-blue-900"
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
