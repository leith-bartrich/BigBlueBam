import { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type IsValidConnection,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './graph-canvas.css';

import { nodeTypes } from './nodes';
import { useGraphEditorStore } from '@/stores/graph-editor.store';

// ─── Allowed connection matrix ───
// trigger  → condition ✓, action ✓
// condition → condition ✓, action ✓
// action   → action ✓
// Nothing  → trigger (triggers are entry-points only)

const ALLOWED_TARGETS: Record<string, Set<string>> = {
  'trigger-node': new Set(['condition-node', 'action-node']),
  'condition-node': new Set(['condition-node', 'action-node']),
  'action-node': new Set(['action-node']),
};

export interface GraphCanvasProps {
  className?: string;
}

export function GraphCanvas({ className }: GraphCanvasProps) {
  const nodes = useGraphEditorStore((s) => s.nodes);
  const edges = useGraphEditorStore((s) => s.edges);
  const onNodesChange = useGraphEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphEditorStore((s) => s.onEdgesChange);
  const onConnect = useGraphEditorStore((s) => s.onConnect);
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  const removeSelected = useGraphEditorStore((s) => s.removeSelected);

  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      // Reject self-loops
      if (connection.source === connection.target) return false;

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;

      // Reject connections TO a trigger node
      if (targetNode.type === 'trigger-node') return false;

      // Check the allowed-targets matrix
      const allowed = ALLOWED_TARGETS[sourceNode.type ?? ''];
      if (!allowed) return false;

      return allowed.has(targetNode.type ?? '');
    },
    [nodes],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Avoid interfering with text inputs
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        removeSelected();
      }
    },
    [removeSelected],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className={className ?? 'w-full h-full'} onKeyDown={onKeyDown} tabIndex={-1}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        defaultEdgeOptions={{ animated: true }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          style={{ width: 120, height: 80 }}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}
