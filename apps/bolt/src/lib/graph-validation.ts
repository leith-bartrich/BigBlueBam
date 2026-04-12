import type { Node, Edge } from '@xyflow/react';
import type { BoltNodeKind } from '@/types/bolt-graph';

export interface GraphValidationError {
  nodeId?: string;
  message: string;
}

/**
 * Validate a graph represented as xyflow nodes and edges.
 *
 * Returns an empty array when the graph is valid.
 */
export function validateGraph(nodes: Node[], edges: Edge[]): GraphValidationError[] {
  const errors: GraphValidationError[] = [];

  // Classify nodes by kind
  const triggerNodes: Node[] = [];
  const actionNodes: Node[] = [];
  const allNodeIds = new Set<string>();

  for (const node of nodes) {
    allNodeIds.add(node.id);
    const kind = (node.data as { kind?: BoltNodeKind }).kind;
    if (kind === 'trigger') triggerNodes.push(node);
    if (kind === 'action') actionNodes.push(node);
  }

  // At least one trigger
  if (triggerNodes.length === 0) {
    errors.push({ message: 'Graph must contain at least one trigger node.' });
  }

  // At most one trigger
  if (triggerNodes.length > 1) {
    for (const t of triggerNodes.slice(1)) {
      errors.push({ nodeId: t.id, message: 'Graph must contain at most one trigger node.' });
    }
  }

  // At least one action
  if (actionNodes.length === 0) {
    errors.push({ message: 'Graph must contain at least one action node.' });
  }

  // Self-loop check
  for (const edge of edges) {
    if (edge.source === edge.target) {
      errors.push({ nodeId: edge.source, message: 'Self-loops are not allowed.' });
    }
  }

  // Build adjacency list (forward direction: source -> targets)
  const adjacency = new Map<string, Set<string>>();
  const incomingCount = new Map<string, number>();

  for (const nodeId of allNodeIds) {
    adjacency.set(nodeId, new Set());
    incomingCount.set(nodeId, 0);
  }

  for (const edge of edges) {
    if (edge.source === edge.target) continue; // skip self-loops already flagged
    if (!allNodeIds.has(edge.source) || !allNodeIds.has(edge.target)) continue;
    adjacency.get(edge.source)!.add(edge.target);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
  }

  // Every non-trigger node must have at least one incoming edge
  for (const node of nodes) {
    const kind = (node.data as { kind?: BoltNodeKind }).kind;
    if (kind === 'trigger') continue;
    if ((incomingCount.get(node.id) ?? 0) === 0) {
      errors.push({ nodeId: node.id, message: 'Non-trigger node has no incoming edges.' });
    }
  }

  // Reachability: every non-trigger node must be reachable from the trigger
  if (triggerNodes.length === 1) {
    const triggerId = triggerNodes[0]!.id;
    const visited = new Set<string>();
    const queue: string[] = [triggerId];
    visited.add(triggerId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    for (const node of nodes) {
      const kind = (node.data as { kind?: BoltNodeKind }).kind;
      if (kind === 'trigger') continue;
      if (!visited.has(node.id)) {
        errors.push({ nodeId: node.id, message: 'Node is not reachable from the trigger.' });
      }
    }
  }

  return errors;
}
