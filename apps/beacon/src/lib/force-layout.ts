/**
 * Simple force-directed layout engine.
 *
 * Pure function — takes nodes + edges, runs N iterations of spring-physics,
 * returns updated (x, y) positions. No DOM or external dependency.
 *
 * Forces applied each iteration:
 *   1. Repulsion — all pairs (Coulomb-like inverse-square)
 *   2. Attraction — along edges (spring / Hooke's law)
 *   3. Centering — gentle pull toward (0, 0)
 */

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  /** Optional radius hint (affects repulsion distance) */
  radius?: number;
  /** If true, position is frozen */
  pinned?: boolean;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface ForceLayoutOptions {
  /** Number of simulation steps (default 80) */
  iterations?: number;
  /** Repulsion strength (default 800) */
  repulsion?: number;
  /** Attraction strength / spring constant (default 0.04) */
  attraction?: number;
  /** Ideal spring length (default 120) */
  idealLength?: number;
  /** Centering pull strength (default 0.01) */
  centering?: number;
  /** Velocity damping per tick (default 0.85) */
  damping?: number;
  /** Starting alpha / temperature (default 1.0) */
  alpha?: number;
}

interface Velocity {
  vx: number;
  vy: number;
}

export function runForceLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: ForceLayoutOptions = {},
): LayoutNode[] {
  const {
    iterations = 80,
    repulsion = 800,
    attraction = 0.04,
    idealLength = 120,
    centering = 0.01,
    damping = 0.85,
    alpha: startAlpha = 1.0,
  } = options;

  if (nodes.length === 0) return [];

  // Clone nodes so we don't mutate input
  const pos = nodes.map((n) => ({ ...n }));
  const vel = new Map<string, Velocity>();
  for (const n of pos) {
    vel.set(n.id, { vx: 0, vy: 0 });
  }

  // Build adjacency index for quick lookup
  const idxMap = new Map<string, number>();
  for (let i = 0; i < pos.length; i++) {
    idxMap.set(pos[i]!.id, i);
  }

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = startAlpha * (1 - iter / iterations);
    if (alpha < 0.001) break;

    // 1. Repulsion (all pairs)
    for (let i = 0; i < pos.length; i++) {
      const a = pos[i]!;
      if (a.pinned) continue;
      const av = vel.get(a.id)!;
      for (let j = i + 1; j < pos.length; j++) {
        const b = pos[j]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) {
          // Jitter to escape overlap
          dx = (Math.random() - 0.5) * 2;
          dy = (Math.random() - 0.5) * 2;
          dist = 1;
        }
        const minDist = (a.radius ?? 20) + (b.radius ?? 20);
        const effectiveDist = Math.max(dist, minDist * 0.5);
        const force = (repulsion * alpha) / (effectiveDist * effectiveDist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        av.vx += fx;
        av.vy += fy;
        if (!b.pinned) {
          const bv = vel.get(b.id)!;
          bv.vx -= fx;
          bv.vy -= fy;
        }
      }
    }

    // 2. Attraction (along edges)
    for (const edge of edges) {
      const si = idxMap.get(edge.source);
      const ti = idxMap.get(edge.target);
      if (si == null || ti == null) continue;
      const a = pos[si]!;
      const b = pos[ti]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - idealLength;
      const force = attraction * displacement * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.pinned) {
        vel.get(a.id)!.vx += fx;
        vel.get(a.id)!.vy += fy;
      }
      if (!b.pinned) {
        vel.get(b.id)!.vx -= fx;
        vel.get(b.id)!.vy -= fy;
      }
    }

    // 3. Centering force
    for (const n of pos) {
      if (n.pinned) continue;
      const v = vel.get(n.id)!;
      v.vx -= n.x * centering * alpha;
      v.vy -= n.y * centering * alpha;
    }

    // 4. Apply velocities + damping
    for (const n of pos) {
      if (n.pinned) continue;
      const v = vel.get(n.id)!;
      // Cap velocity
      const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
      const maxSpeed = 50;
      if (speed > maxSpeed) {
        v.vx = (v.vx / speed) * maxSpeed;
        v.vy = (v.vy / speed) * maxSpeed;
      }
      n.x += v.vx;
      n.y += v.vy;
      v.vx *= damping;
      v.vy *= damping;
    }
  }

  return pos;
}

/**
 * Assign initial positions in a circle or random spread if nodes lack positions.
 */
export function initializePositions(nodes: LayoutNode[], width: number, height: number): LayoutNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.3;

  return nodes.map((n, i) => {
    if (n.x !== 0 || n.y !== 0) return n;
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
    return {
      ...n,
      x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
      y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
    };
  });
}
