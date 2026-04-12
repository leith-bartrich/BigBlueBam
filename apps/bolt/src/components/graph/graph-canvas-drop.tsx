import { useCallback, useRef } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import type { BoltNodeKind } from '@/types/bolt-graph';
import { useGraphEditorStore } from '@/stores/graph-editor.store';
import { GraphCanvas } from './graph-canvas';

interface GraphCanvasDropInnerProps {
  className?: string;
}

/**
 * Inner component that uses `useReactFlow()` — must be rendered inside a
 * `<ReactFlowProvider>`.
 */
function GraphCanvasDropInner({ className }: GraphCanvasDropInnerProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useGraphEditorStore((s) => s.addNode);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData('application/bolt-node-kind') as BoltNodeKind;
      if (!kind) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(kind, position);
    },
    [screenToFlowPosition, addNode],
  );

  return (
    <div
      ref={reactFlowWrapper}
      className={className ?? 'w-full h-full'}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <GraphCanvas />
    </div>
  );
}

/**
 * Drag-and-drop wrapper around `<GraphCanvas>`.
 *
 * Wraps itself in a `<ReactFlowProvider>` so that `useReactFlow()` is
 * available for coordinate conversion. If a parent already provides the
 * provider (e.g. the page-level layout from Slice 6), the extra provider
 * is harmless — xyflow nests providers correctly.
 */
export function GraphCanvasWithDrop({ className }: { className?: string }) {
  return (
    <ReactFlowProvider>
      <GraphCanvasDropInner className={className} />
    </ReactFlowProvider>
  );
}
