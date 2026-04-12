import type { Node, Edge } from '@xyflow/react';
import type { BoltGraph, BoltGraphNode, BoltGraphEdge, BoltNodeKind } from '@/types/bolt-graph';

/**
 * Deserialize a backend BoltGraph into xyflow Node[] + Edge[].
 *
 * Each BoltGraphNode becomes an xyflow Node whose `type` is `${kind}-node`
 * and whose `data` carries the original payload plus a `kind` discriminator.
 */
export function deserializeGraph(graph: BoltGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n: BoltGraphNode) => ({
    id: n.id,
    type: `${n.kind}-node`,
    position: { x: n.position.x, y: n.position.y },
    data: { kind: n.kind, ...n.data },
  }));

  const edges: Edge[] = graph.edges.map((e: BoltGraphEdge) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    targetHandle: e.targetHandle,
  }));

  return { nodes, edges };
}

/**
 * Serialize xyflow Node[] + Edge[] back into a backend BoltGraph.
 *
 * Strips the `kind` discriminator from node data and maps `node.data.kind`
 * back to the `BoltGraphNode.kind` field.
 */
export function serializeGraph(nodes: Node[], edges: Edge[]): BoltGraph {
  const graphNodes: BoltGraphNode[] = nodes.map((n) => {
    const { kind, ...rest } = n.data as { kind: BoltNodeKind } & Record<string, unknown>;
    return {
      id: n.id,
      kind,
      position: { x: n.position.x, y: n.position.y },
      data: rest as Record<string, unknown>,
    };
  });

  const graphEdges: BoltGraphEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle ?? '',
    target: e.target,
    targetHandle: e.targetHandle ?? '',
  }));

  return { version: 1, nodes: graphNodes, edges: graphEdges };
}
