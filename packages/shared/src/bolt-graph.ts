/**
 * Shared graph types for Bolt's node-graph editor.
 *
 * These types describe the in-memory and persisted form of an automation
 * expressed as a directed acyclic graph of nodes and edges. The graph is
 * stored in `bolt_automations.graph` (JSONB) and round-trips losslessly
 * for automations that fit the "simple" linear shape.
 *
 * The relational rows (bolt_conditions, bolt_actions) remain authoritative
 * for execution — the graph is a projection/view that the compiler and
 * projector translate to/from those rows.
 */

export type BoltNodeKind = 'trigger' | 'condition' | 'action';

/**
 * Port type system. Primitive scalars, template references (`ref:<name>`),
 * and entity references (`entity:<kind>`) allow the canvas to validate
 * connections and the inspector to offer appropriate pickers.
 */
export type BoltPortType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | `ref:${string}`
  | `entity:${string}`
  | 'any';

export interface BoltGraphNode {
  id: string;
  kind: BoltNodeKind;
  position: { x: number; y: number };
  /** Payload varies by kind — see TriggerNodeData, ConditionNodeData, ActionNodeData. */
  data: Record<string, unknown>;
}

export interface BoltGraphEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface BoltGraph {
  version: 1;
  nodes: BoltGraphNode[];
  edges: BoltGraphEdge[];
}

// ---------------------------------------------------------------------------
// Typed data payloads (cast from BoltGraphNode.data by kind)
// ---------------------------------------------------------------------------

/** Data payload for a node with kind === 'trigger'. */
export interface TriggerNodeData {
  source: string;
  event: string;
  filter: Record<string, unknown>;
}

/** Data payload for a node with kind === 'condition'. */
export interface ConditionNodeData {
  field: string;
  operator: string;
  value: unknown;
  logicGroup: 'and' | 'or';
}

/** Data payload for a node with kind === 'action'. */
export interface ActionNodeData {
  mcpTool: string;
  parameters: Record<string, unknown>;
  onError: 'fail' | 'continue' | 'retry';
  retryCount: number;
  retryDelayMs: number;
}
