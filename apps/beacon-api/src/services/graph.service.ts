/**
 * Graph service — BFS neighbor traversal, hub scoring, and recency queries
 * for the Knowledge Graph Explorer (§5.5.3).
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  tags: string[];
  verification_count: number;
  inbound_link_count: number;
  expires_at: string | null;
  last_verified_at: string | null;
  owned_by: string;
}

export interface ExplicitEdge {
  source_id: string;
  target_id: string;
  edge_type: 'explicit';
  link_type: string;
}

export interface ImplicitEdge {
  source_id: string;
  target_id: string;
  edge_type: 'implicit';
  shared_tags: string[];
  shared_tag_count: number;
}

export type GraphEdge = ExplicitEdge | ImplicitEdge;

export interface NeighborResult {
  focal_beacon_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// Redis cache helper (lazy singleton — set by route registration)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

export function setRedis(redis: Redis) {
  _redis = redis;
}

const IMPLICIT_TTL = 600; // 10 minutes

// ---------------------------------------------------------------------------
// getNeighbors — BFS up to N hops
// ---------------------------------------------------------------------------

export async function getNeighbors(
  beaconId: string,
  hops: number,
  includeImplicit: boolean,
  tagAffinityThreshold: number,
  statusFilter: string[],
): Promise<NeighborResult> {
  // BFS: collect node IDs layer by layer
  const visited = new Set<string>([beaconId]);
  let frontier = [beaconId];
  const allExplicitEdges: ExplicitEdge[] = [];

  for (let depth = 0; depth < hops && frontier.length > 0; depth++) {
    // Fetch explicit edges for current frontier
    const rows: any[] = await db.execute(sql`
      SELECT bl.source_id, bl.target_id, bl.link_type
      FROM beacon_links bl
      JOIN beacon_entries be_src ON be_src.id = bl.source_id
      JOIN beacon_entries be_tgt ON be_tgt.id = bl.target_id
      WHERE (bl.source_id = ANY(${frontier}) OR bl.target_id = ANY(${frontier}))
        AND be_src.status = ANY(${statusFilter})
        AND be_tgt.status = ANY(${statusFilter})
    `);

    const nextFrontier: string[] = [];
    for (const row of rows) {
      const edge: ExplicitEdge = {
        source_id: row.source_id,
        target_id: row.target_id,
        edge_type: 'explicit',
        link_type: row.link_type,
      };
      allExplicitEdges.push(edge);

      for (const nid of [row.source_id, row.target_id]) {
        if (!visited.has(nid)) {
          visited.add(nid);
          nextFrontier.push(nid);
        }
      }
    }
    frontier = nextFrontier;
  }

  // Implicit edges via tag affinity
  const allImplicitEdges: ImplicitEdge[] = [];
  if (includeImplicit) {
    const nodeIds = Array.from(visited);
    for (const nodeId of nodeIds) {
      const implicit = await getImplicitEdges(nodeId, tagAffinityThreshold, statusFilter);
      for (const edge of implicit) {
        // Only include edges where both ends are in our node set OR we add the new node
        visited.add(edge.source_id);
        visited.add(edge.target_id);
        allImplicitEdges.push(edge);
      }
    }
  }

  // Fetch full node data for all collected IDs
  const nodeIds = Array.from(visited);
  const nodes = await fetchNodes(nodeIds, statusFilter);

  // Deduplicate edges
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const e of allExplicitEdges) {
    const key = `explicit:${e.source_id}:${e.target_id}:${e.link_type}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push(e);
    }
  }
  for (const e of allImplicitEdges) {
    const key = `implicit:${[e.source_id, e.target_id].sort().join(':')}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push(e);
    }
  }

  return { focal_beacon_id: beaconId, nodes, edges };
}

// ---------------------------------------------------------------------------
// Implicit edges — self-join on beacon_tags, cached in Redis
// ---------------------------------------------------------------------------

async function getImplicitEdges(
  beaconId: string,
  threshold: number,
  statusFilter: string[],
): Promise<ImplicitEdge[]> {
  const cacheKey = `beacon:implicit:${beaconId}`;

  // Try Redis cache
  if (_redis) {
    try {
      const cached = await _redis.get(cacheKey);
      if (cached) {
        const parsed: ImplicitEdge[] = JSON.parse(cached);
        return parsed.filter((e) => e.shared_tag_count >= threshold);
      }
    } catch {
      // Cache miss — fall through to DB
    }
  }

  // SQL self-join: find beacons sharing tags with beaconId
  const rows: any[] = await db.execute(sql`
    SELECT
      t1.beacon_id AS source_id,
      t2.beacon_id AS target_id,
      ARRAY_AGG(t1.tag) AS shared_tags,
      COUNT(*)::int AS shared_tag_count
    FROM beacon_tags t1
    JOIN beacon_tags t2 ON t1.tag = t2.tag AND t1.beacon_id <> t2.beacon_id
    JOIN beacon_entries be ON be.id = t2.beacon_id
    WHERE t1.beacon_id = ${beaconId}
      AND be.status = ANY(${statusFilter})
    GROUP BY t1.beacon_id, t2.beacon_id
    HAVING COUNT(*) >= 2
  `);

  const edges: ImplicitEdge[] = rows.map((r) => ({
    source_id: r.source_id,
    target_id: r.target_id,
    edge_type: 'implicit' as const,
    shared_tags: r.shared_tags,
    shared_tag_count: r.shared_tag_count,
  }));

  // Cache all edges (with minimum threshold=2) in Redis
  if (_redis) {
    try {
      await _redis.setex(cacheKey, IMPLICIT_TTL, JSON.stringify(edges));
    } catch {
      // Best effort
    }
  }

  return edges.filter((e) => e.shared_tag_count >= threshold);
}

// ---------------------------------------------------------------------------
// fetchNodes — batch-load node details with inbound link counts
// ---------------------------------------------------------------------------

async function fetchNodes(
  nodeIds: string[],
  statusFilter: string[],
): Promise<GraphNode[]> {
  if (nodeIds.length === 0) return [];

  const rows: any[] = await db.execute(sql`
    SELECT
      be.id,
      be.title,
      be.summary,
      be.status,
      be.verification_count,
      be.expires_at,
      be.last_verified_at,
      be.owned_by,
      COALESCE(lc.cnt, 0)::int AS inbound_link_count,
      COALESCE(
        (SELECT ARRAY_AGG(bt.tag) FROM beacon_tags bt WHERE bt.beacon_id = be.id),
        '{}'
      ) AS tags
    FROM beacon_entries be
    LEFT JOIN (
      SELECT target_id, COUNT(*)::int AS cnt
      FROM beacon_links
      GROUP BY target_id
    ) lc ON lc.target_id = be.id
    WHERE be.id = ANY(${nodeIds})
      AND be.status = ANY(${statusFilter})
  `);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    status: r.status,
    tags: r.tags ?? [],
    verification_count: r.verification_count,
    inbound_link_count: r.inbound_link_count,
    expires_at: r.expires_at?.toISOString?.() ?? r.expires_at ?? null,
    last_verified_at: r.last_verified_at?.toISOString?.() ?? r.last_verified_at ?? null,
    owned_by: r.owned_by,
  }));
}

// ---------------------------------------------------------------------------
// getHubs — top-K beacons by (inbound link count + verification_count) DESC
// ---------------------------------------------------------------------------

export async function getHubs(
  scope: 'project' | 'organization',
  projectId: string | null,
  orgId: string,
  topK: number,
): Promise<GraphNode[]> {
  const scopeFilter =
    scope === 'project' && projectId
      ? sql`AND be.project_id = ${projectId}`
      : sql`AND be.organization_id = ${orgId}`;

  const rows: any[] = await db.execute(sql`
    SELECT
      be.id,
      be.title,
      be.summary,
      be.status,
      be.verification_count,
      be.expires_at,
      be.last_verified_at,
      be.owned_by,
      COALESCE(lc.cnt, 0)::int AS inbound_link_count,
      COALESCE(
        (SELECT ARRAY_AGG(bt.tag) FROM beacon_tags bt WHERE bt.beacon_id = be.id),
        '{}'
      ) AS tags
    FROM beacon_entries be
    LEFT JOIN (
      SELECT target_id, COUNT(*)::int AS cnt
      FROM beacon_links
      GROUP BY target_id
    ) lc ON lc.target_id = be.id
    WHERE be.status IN ('Active', 'PendingReview')
      ${scopeFilter}
    ORDER BY (COALESCE(lc.cnt, 0) + be.verification_count) DESC
    LIMIT ${topK}
  `);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    status: r.status,
    tags: r.tags ?? [],
    verification_count: r.verification_count,
    inbound_link_count: r.inbound_link_count,
    expires_at: r.expires_at?.toISOString?.() ?? r.expires_at ?? null,
    last_verified_at: r.last_verified_at?.toISOString?.() ?? r.last_verified_at ?? null,
    owned_by: r.owned_by,
  }));
}

// ---------------------------------------------------------------------------
// getRecent — beacons updated or verified in the last N days
// ---------------------------------------------------------------------------

export async function getRecent(
  scope: 'project' | 'organization',
  projectId: string | null,
  orgId: string,
  days: number,
): Promise<GraphNode[]> {
  const scopeFilter =
    scope === 'project' && projectId
      ? sql`AND be.project_id = ${projectId}`
      : sql`AND be.organization_id = ${orgId}`;

  const rows: any[] = await db.execute(sql`
    SELECT
      be.id,
      be.title,
      be.summary,
      be.status,
      be.verification_count,
      be.expires_at,
      be.last_verified_at,
      be.owned_by,
      COALESCE(lc.cnt, 0)::int AS inbound_link_count,
      COALESCE(
        (SELECT ARRAY_AGG(bt.tag) FROM beacon_tags bt WHERE bt.beacon_id = be.id),
        '{}'
      ) AS tags
    FROM beacon_entries be
    LEFT JOIN (
      SELECT target_id, COUNT(*)::int AS cnt
      FROM beacon_links
      GROUP BY target_id
    ) lc ON lc.target_id = be.id
    WHERE be.status IN ('Active', 'PendingReview')
      ${scopeFilter}
      AND (
        be.updated_at > NOW() - MAKE_INTERVAL(days => ${days})
        OR be.last_verified_at > NOW() - MAKE_INTERVAL(days => ${days})
      )
    ORDER BY GREATEST(be.updated_at, COALESCE(be.last_verified_at, be.updated_at)) DESC
  `);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    status: r.status,
    tags: r.tags ?? [],
    verification_count: r.verification_count,
    inbound_link_count: r.inbound_link_count,
    expires_at: r.expires_at?.toISOString?.() ?? r.expires_at ?? null,
    last_verified_at: r.last_verified_at?.toISOString?.() ?? r.last_verified_at ?? null,
    owned_by: r.owned_by,
  }));
}
