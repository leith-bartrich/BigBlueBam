/**
 * Local re-export of shared Bolt graph types.
 *
 * `@bigbluebam/shared` is not yet a dependency of the bolt frontend.
 * These mirror the canonical definitions in packages/shared/src/bolt-graph.ts.
 * When the shared package is wired into bolt's package.json, replace this
 * file with a re-export: `export type { ... } from '@bigbluebam/shared';`
 */

export type BoltNodeKind = 'trigger' | 'condition' | 'action';

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

export interface TriggerNodeData {
  source: string;
  event: string;
  filter: Record<string, unknown>;
}

export interface ConditionNodeData {
  field: string;
  operator: string;
  value: unknown;
  logicGroup: 'and' | 'or';
}

export interface ActionNodeData {
  mcpTool: string;
  parameters: Record<string, unknown>;
  onError: 'fail' | 'continue' | 'retry';
  retryCount: number;
  retryDelayMs: number;
}
