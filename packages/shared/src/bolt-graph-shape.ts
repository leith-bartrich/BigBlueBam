import type { BoltGraph, BoltGraphNode, BoltGraphEdge } from './bolt-graph.js';

export type ShapeCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * Check whether a graph fits the "simple" linear shape:
 *
 *   exactly-one trigger node
 *     → zero-or-more condition nodes (linear chain, no branches)
 *       → one-or-more action nodes (linear chain, no branches)
 *
 * "Linearity" is about control-flow edges. Data-flow edges from an action
 * output handle to a downstream action's parameter handle are allowed and
 * do NOT count as branching.
 *
 * Returns { ok: true } for a valid simple shape.
 * Returns { ok: false, reason: '...' } on any violation.
 */
export function isSimpleShape(graph: BoltGraph): ShapeCheckResult {
  const { nodes, edges } = graph;

  // ── 1. Exactly one trigger node ──────────────────────────────────────────
  const triggerNodes = nodes.filter((n) => n.kind === 'trigger');
  if (triggerNodes.length === 0) {
    return { ok: false, reason: 'Graph has no trigger node.' };
  }
  if (triggerNodes.length > 1) {
    return { ok: false, reason: `Graph has ${triggerNodes.length} trigger nodes; exactly one is required.` };
  }

  const nodeMap = new Map<string, BoltGraphNode>(nodes.map((n) => [n.id, n]));

  // ── 2. Build control-flow adjacency (exclude data-flow edges) ────────────
  //
  // A "control-flow edge" is an edge whose sourceHandle does NOT look like
  // an output port of an action result (i.e. not "output-<field>"). In the
  // simple shape the single outgoing control edge from each node uses
  // handle names like "output", "true", "next", etc.
  //
  // Data-flow edges: source is an action node AND sourceHandle is
  // "output-<something>" (they wire a result field to a downstream param).
  // These are allowed and are excluded from the linearity check.
  //
  // We use a simple heuristic: if the source node is an action and the
  // target is also an action and the targetHandle does NOT start with
  // "control", treat it as a data-flow edge.
  //
  // More precisely: an edge is a CONTROL edge when at least one of the
  // following holds:
  //   a) source node is a trigger or condition, OR
  //   b) targetHandle starts with "control" or equals "input", OR
  //   c) sourceHandle is exactly "output" (the single control output)
  //
  // Everything else (action → action via result/param handles) is data-flow.

  function isControlEdge(edge: BoltGraphEdge): boolean {
    const srcNode = nodeMap.get(edge.source);
    if (!srcNode) return true; // treat unknown as control for safety
    if (srcNode.kind !== 'action') return true; // trigger/condition edges are always control
    // action→action: control if sourceHandle is "output" or target handle is "input" or "control"
    if (edge.sourceHandle === 'output') return true;
    if (edge.targetHandle === 'input' || edge.targetHandle.startsWith('control')) return true;
    return false;
  }

  // outgoing control edges per node
  const controlOut = new Map<string, BoltGraphEdge[]>();
  // incoming control edges per node
  const controlIn = new Map<string, BoltGraphEdge[]>();

  for (const node of nodes) {
    controlOut.set(node.id, []);
    controlIn.set(node.id, []);
  }

  for (const edge of edges) {
    if (!isControlEdge(edge)) continue;
    controlOut.get(edge.source)?.push(edge);
    controlIn.get(edge.target)?.push(edge);
  }

  // ── 3. No cycles (DFS from trigger) ──────────────────────────────────────
  {
    const visited = new Set<string>();
    const stack = new Set<string>();
    function dfs(nodeId: string): boolean {
      if (stack.has(nodeId)) return true; // cycle
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      stack.add(nodeId);
      for (const edge of (controlOut.get(nodeId) ?? [])) {
        if (dfs(edge.target)) return true;
      }
      stack.delete(nodeId);
      return false;
    }
    if (dfs(triggerNodes[0]!.id)) {
      return { ok: false, reason: 'Graph contains a cycle in the control-flow path.' };
    }
  }

  // ── 4. No multi-root graphs (trigger is the only node with in-degree 0) ──
  for (const node of nodes) {
    if (node.kind !== 'trigger' && (controlIn.get(node.id)?.length ?? 0) === 0) {
      return {
        ok: false,
        reason: `Node "${node.id}" (kind: ${node.kind}) has no incoming control-flow edge — multi-root graphs are not allowed.`,
      };
    }
  }

  // ── 5. Walk the linear chain from trigger ────────────────────────────────
  //
  // Expected order: trigger → (condition*) → (action+)
  // Each node must have at most one outgoing control-flow edge.

  let current: BoltGraphNode = triggerNodes[0]!;
  let seenAction = false;

  // Bounds guard: at most nodes.length iterations to avoid infinite loops
  // on graphs where the cycle check somehow missed something.
  for (let i = 0; i < nodes.length; i++) {
    const outEdges = controlOut.get(current.id) ?? [];

    // Branching check: more than one outgoing control edge = branch
    if (outEdges.length > 1) {
      return {
        ok: false,
        reason: `Node "${current.id}" (kind: ${current.kind}) has ${outEdges.length} outgoing control-flow edges; branching is not allowed in the simple shape.`,
      };
    }

    // Track phase transitions
    if (current.kind === 'action') {
      seenAction = true;
    }

    // Condition-after-action is illegal
    if (seenAction && current.kind === 'condition') {
      return {
        ok: false,
        reason: `Condition node "${current.id}" appears after an action node; conditions must precede all actions.`,
      };
    }

    if (outEdges.length === 0) {
      // End of chain — must have seen at least one action
      if (!seenAction) {
        return { ok: false, reason: 'Graph has no action nodes; at least one action is required.' };
      }
      break;
    }

    const nextNodeId = outEdges[0]!.target;
    const nextNode = nodeMap.get(nextNodeId);
    if (!nextNode) {
      return { ok: false, reason: `Edge points to unknown node "${nextNodeId}".` };
    }
    current = nextNode;
  }

  return { ok: true };
}
