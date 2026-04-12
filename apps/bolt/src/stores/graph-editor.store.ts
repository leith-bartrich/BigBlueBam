import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import type { BoltGraph, BoltNodeKind } from '@/types/bolt-graph';
import { deserializeGraph, serializeGraph } from '@/lib/graph-serializer';

// ─── Default data payloads by node kind ───

function defaultDataForKind(kind: BoltNodeKind): Record<string, unknown> {
  switch (kind) {
    case 'trigger':
      return { kind, source: '', event: '', filter: {} };
    case 'condition':
      return { kind, field: '', operator: 'equals', value: '', logicGroup: 'and' };
    case 'action':
      return { kind, mcpTool: '', parameters: {}, onError: 'fail', retryCount: 0, retryDelayMs: 1000 };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

// ─── State interface ───

export interface GraphEditorState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  isDirty: boolean;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  selectNode: (id: string | null) => void;
  addNode: (kind: BoltNodeKind, position: { x: number; y: number }) => void;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
  removeSelected: () => void;
  loadFromGraph: (graph: BoltGraph) => void;
  toGraph: () => BoltGraph;
  reset: () => void;
  markClean: () => void;
}

// ─── Store ───

export const useGraphEditorStore = create<GraphEditorState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,

  setNodes: (nodes) => set({ nodes, isDirty: true }),

  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection: Connection) => {
    // No self-loops
    if (connection.source === connection.target) return;

    set((state) => ({
      edges: addEdge(connection, state.edges),
      isDirty: true,
    }));
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  addNode: (kind, position) => {
    const id = crypto.randomUUID();
    const newNode: Node = {
      id,
      type: `${kind}-node`,
      position,
      data: defaultDataForKind(kind),
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      isDirty: true,
    }));
  },

  updateNodeData: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node,
      ),
      isDirty: true,
    }));
  },

  removeSelected: () => {
    const { selectedNodeId } = get();
    if (!selectedNodeId) return;
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== selectedNodeId),
      edges: state.edges.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
      ),
      selectedNodeId: null,
      isDirty: true,
    }));
  },

  loadFromGraph: (graph) => {
    const { nodes, edges } = deserializeGraph(graph);
    set({ nodes, edges, selectedNodeId: null, isDirty: false });
  },

  toGraph: () => {
    const { nodes, edges } = get();
    return serializeGraph(nodes, edges);
  },

  reset: () => set({ nodes: [], edges: [], selectedNodeId: null, isDirty: false }),

  markClean: () => set({ isDirty: false }),
}));
