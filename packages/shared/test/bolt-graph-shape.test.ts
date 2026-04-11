import { describe, it, expect } from 'vitest';
import { isSimpleShape } from '../src/bolt-graph-shape.js';
import type { BoltGraph } from '../src/bolt-graph.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triggerNode(id = 't1') {
  return { id, kind: 'trigger' as const, position: { x: 0, y: 0 }, data: {} };
}

function conditionNode(id: string) {
  return { id, kind: 'condition' as const, position: { x: 200, y: 0 }, data: {} };
}

function actionNode(id: string) {
  return { id, kind: 'action' as const, position: { x: 400, y: 0 }, data: {} };
}

function controlEdge(source: string, target: string, id?: string) {
  return {
    id: id ?? `${source}->${target}`,
    source,
    sourceHandle: 'output',
    target,
    targetHandle: 'input',
  };
}

function dataEdge(source: string, sourceHandle: string, target: string, targetHandle: string) {
  return {
    id: `${source}.${sourceHandle}->${target}.${targetHandle}`,
    source,
    sourceHandle,
    target,
    targetHandle,
  };
}

// ---------------------------------------------------------------------------
// Happy-path tests
// ---------------------------------------------------------------------------

describe('isSimpleShape — happy path', () => {
  it('trigger only with one implicit action → should fail (no actions)', () => {
    const graph: BoltGraph = {
      version: 1,
      nodes: [triggerNode()],
      edges: [],
    };
    expect(isSimpleShape(graph)).toEqual({
      ok: false,
      reason: expect.stringContaining('no action nodes'),
    });
  });

  it('trigger + 1 action', () => {
    const graph: BoltGraph = {
      version: 1,
      nodes: [triggerNode('t1'), actionNode('a1')],
      edges: [controlEdge('t1', 'a1')],
    };
    expect(isSimpleShape(graph)).toEqual({ ok: true });
  });

  it('trigger + 2 conditions + 3 actions', () => {
    const graph: BoltGraph = {
      version: 1,
      nodes: [
        triggerNode('t1'),
        conditionNode('c1'),
        conditionNode('c2'),
        actionNode('a1'),
        actionNode('a2'),
        actionNode('a3'),
      ],
      edges: [
        controlEdge('t1', 'c1'),
        controlEdge('c1', 'c2'),
        controlEdge('c2', 'a1'),
        controlEdge('a1', 'a2'),
        controlEdge('a2', 'a3'),
      ],
    };
    expect(isSimpleShape(graph)).toEqual({ ok: true });
  });

  it('action output → next action parameter handle (data-flow) is allowed', () => {
    const graph: BoltGraph = {
      version: 1,
      nodes: [triggerNode('t1'), actionNode('a1'), actionNode('a2')],
      edges: [
        controlEdge('t1', 'a1'),
        controlEdge('a1', 'a2'),
        // data-flow edge: a1's result "task_id" → a2's "task_id" param
        dataEdge('a1', 'result-task_id', 'a2', 'param-task_id'),
      ],
    };
    expect(isSimpleShape(graph)).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Failure cases
// ---------------------------------------------------------------------------

describe('isSimpleShape — failure cases', () => {
  it('zero triggers', () => {
    const graph: BoltGraph = {
      version: 1,
      nodes: [actionNode('a1')],
      edges: [],
    };
    const result = isSimpleShape(graph);
    expect(result.ok).toBe(false);
    expect((result as any).reason).toMatch(/no trigger/i);
  });

  it('two triggers', () => {
    const graph: BoltGraph = {
      version: 1,
      nodes: [triggerNode('t1'), triggerNode('t2'), actionNode('a1')],
      edges: [controlEdge('t1', 'a1')],
    };
    const result = isSimpleShape(graph);
    expect(result.ok).toBe(false);
    expect((result as any).reason).toMatch(/2 trigger nodes/);
  });

  it('branching from trigger', () => {
    const graph: BoltGraph = {
      version: 1,
      nodes: [triggerNode('t1'), actionNode('a1'), actionNode('a2')],
      edges: [
        controlEdge('t1', 'a1', 'e1'),
        controlEdge('t1', 'a2', 'e2'),
      ],
    };
    const result = isSimpleShape(graph);
    expect(result.ok).toBe(false);
    expect((result as any).reason).toMatch(/branching is not allowed/i);
  });

  it('condition after action', () => {
    const graph: BoltGraph = {
      version: 1,
      nodes: [triggerNode('t1'), actionNode('a1'), conditionNode('c1')],
      edges: [
        controlEdge('t1', 'a1'),
        controlEdge('a1', 'c1'),
      ],
    };
    const result = isSimpleShape(graph);
    expect(result.ok).toBe(false);
    expect((result as any).reason).toMatch(/condition.*after an action/i);
  });

  it('cycle', () => {
    const graph: BoltGraph = {
      version: 1,
      nodes: [triggerNode('t1'), actionNode('a1'), actionNode('a2')],
      edges: [
        controlEdge('t1', 'a1'),
        controlEdge('a1', 'a2'),
        controlEdge('a2', 'a1'), // back-edge creates cycle
      ],
    };
    const result = isSimpleShape(graph);
    expect(result.ok).toBe(false);
    expect((result as any).reason).toMatch(/cycle/i);
  });

  it('multi-root: orphan action node with no incoming edge', () => {
    const graph: BoltGraph = {
      version: 1,
      nodes: [triggerNode('t1'), actionNode('a1'), actionNode('a2')],
      edges: [
        controlEdge('t1', 'a1'),
        // a2 has no incoming edge → multi-root
      ],
    };
    const result = isSimpleShape(graph);
    // Either "no action nodes" (chain ends at a1 with no outgoing) or multi-root
    // Depending on traversal, a1 ends the chain successfully — but a2 has no incoming.
    // The multi-root check fires first in this implementation.
    expect(result.ok).toBe(false);
  });
});
