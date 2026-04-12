import { GraphCanvasWithDrop } from './graph-canvas-drop';
import { NodePalette } from './node-palette';
import { NodeInspector } from './panels/node-inspector';

/**
 * Composition root for the visual graph editor.
 *
 * Layout: NodePalette (~56px) | GraphCanvasWithDrop (flex-1) | NodeInspector (320px, collapses when nothing selected).
 */
export function GraphEditorView() {
  return (
    <div className="flex h-full min-h-[500px]">
      <NodePalette />
      <div className="flex-1 relative">
        <GraphCanvasWithDrop className="w-full h-full" />
      </div>
      <NodeInspector />
    </div>
  );
}
