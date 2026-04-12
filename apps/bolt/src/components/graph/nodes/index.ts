import type { NodeTypes } from '@xyflow/react';
import { TriggerNode } from './trigger-node';
import { ConditionNode } from './condition-node';
import { ActionNode } from './action-node';

export const nodeTypes: NodeTypes = {
  'trigger-node': TriggerNode,
  'condition-node': ConditionNode,
  'action-node': ActionNode,
};

export { TriggerNode, ConditionNode, ActionNode };
