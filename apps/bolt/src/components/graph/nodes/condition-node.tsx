import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Filter } from 'lucide-react';
import type { ConditionNodeData } from '@/types/bolt-graph';

type ConditionNodeDataWithKind = ConditionNodeData & { kind: 'condition' } & Record<string, unknown>;
type ConditionNode = Node<ConditionNodeDataWithKind, 'condition-node'>;

function ConditionNodeComponent({ data, selected }: NodeProps<ConditionNode>) {
  const valueLabel =
    data.value === null || data.value === undefined || data.value === ''
      ? '?'
      : String(data.value);

  const summary =
    data.field && data.operator
      ? `${data.field} ${data.operator} ${valueLabel}`
      : 'Not configured';

  return (
    <div
      className={`group relative w-[180px] rounded-lg border bg-amber-50 dark:bg-amber-900/20 ${
        selected
          ? 'ring-2 ring-amber-500 border-amber-400 dark:border-amber-500'
          : 'border-amber-200 dark:border-amber-800/50'
      }`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        className="!h-2.5 !w-2.5 !border-2 !border-amber-400 !bg-amber-100 dark:!border-amber-500 dark:!bg-amber-900"
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 rounded-t-lg bg-amber-100 px-2.5 py-1.5 dark:bg-amber-900/40">
        <Filter className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Condition
        </span>
        {/* Logic group badge */}
        <span className="ml-auto rounded bg-amber-200 px-1 py-0.5 text-[10px] font-bold leading-none text-amber-800 dark:bg-amber-800/60 dark:text-amber-200">
          {data.logicGroup?.toUpperCase() ?? 'AND'}
        </span>
      </div>

      {/* Body */}
      <div className="px-2.5 py-2">
        <p className="truncate text-sm font-medium text-amber-900 dark:text-amber-100">
          {summary}
        </p>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="!h-2.5 !w-2.5 !border-2 !border-amber-400 !bg-amber-100 dark:!border-amber-500 dark:!bg-amber-900"
      />
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
