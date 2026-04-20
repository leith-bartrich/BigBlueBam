import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { entityLinks } from '../db/schema/entity-links.js';
import {
  preflightAccess,
  SUPPORTED_ENTITY_TYPES,
  type VisibilityEntityType,
  type PreflightResult,
} from './visibility.service.js';

/**
 * Entity-links service (AGENTIC_TODO §16, Wave 4).
 *
 * Behavior summary:
 *   - Writes run `preflightAccess` for BOTH endpoints. If either side is not
 *     accessible to the caller, the write is rejected with a typed error.
 *   - Writes only accept types in the Wave 2 `can_access` allowlist (9 types:
 *     bam.task, bam.project, bam.sprint, helpdesk.ticket, bond.deal,
 *     bond.contact, bond.company, brief.document, beacon.entry). Migration
 *     0132 backfill includes some types outside the allowlist (bill.invoice,
 *     bill.client, bill.expense, bill.line_item, book.booking_page) because
 *     those are historical links; new writes for those types are rejected.
 *   - Reads filter out rows where the far side is not accessible and
 *     increment `filtered_count`. A filtered row is silently dropped (NOT a
 *     403), since the default list flow is "show me everything I can see".
 *   - Cycle guard: `parent_of` and `derived_from` writes walk the ancestor
 *     graph for the src side and reject a write that would close a cycle
 *     through dst.
 */

export type LinkKind =
  | 'related_to'
  | 'duplicates'
  | 'blocks'
  | 'references'
  | 'parent_of'
  | 'derived_from';

export const LINK_KINDS: readonly LinkKind[] = [
  'related_to',
  'duplicates',
  'blocks',
  'references',
  'parent_of',
  'derived_from',
] as const;

export type EntityLinkRow = {
  id: string;
  org_id: string;
  src_type: string;
  src_id: string;
  dst_type: string;
  dst_id: string;
  link_kind: LinkKind;
  created_by: string | null;
  created_at: Date;
};

type EntityLinkRowWithDirection = EntityLinkRow & {
  direction: 'outbound' | 'inbound';
};

export type CreateResult =
  | { ok: true; created: boolean; data: EntityLinkRow }
  | {
      ok: false;
      code:
        | 'UNSUPPORTED_ENTITY_TYPE'
        | 'FORBIDDEN'
        | 'CYCLE_DETECTED'
        | 'VALIDATION_ERROR';
      status: 400 | 403;
      message: string;
      details?: unknown[];
      preflight?: { side: 'src' | 'dst'; reason: string };
    };

export type ListResult = {
  data: EntityLinkRowWithDirection[];
  filtered_count: number;
};

export type RemoveResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' | 'FORBIDDEN'; status: 404 | 403; message: string };

export function isSupportedType(t: string): t is VisibilityEntityType {
  return (SUPPORTED_ENTITY_TYPES as readonly string[]).includes(t);
}

export function isLinkKind(k: string): k is LinkKind {
  return (LINK_KINDS as readonly string[]).includes(k);
}

// ---------------------------------------------------------------------------
// Cycle detection for parent_of / derived_from
// ---------------------------------------------------------------------------
//
// For a DAG kind K, inserting src -> dst creates a cycle iff src is reachable
// from dst by walking forward on kind K. Equivalently: if any ancestor chain
// from dst (following incoming edges for the same kind on the same type)
// reaches src, we have a cycle.
//
// Concretely for parent_of: if A parent_of B, then adding B parent_of A
// closes a cycle. Adding B parent_of C closes one if C is reachable (by
// parent_of) back to B through some chain.
//
// Walk forward: starting from dst, follow rows where (src_type, src_id) =
// (current_type, current_id) AND link_kind = kind. If we ever reach src,
// cycle. Bounded by a visited set to survive dirty data.

async function wouldCreateCycle(
  kind: LinkKind,
  srcType: string,
  srcId: string,
  dstType: string,
  dstId: string,
): Promise<boolean> {
  if (kind !== 'parent_of' && kind !== 'derived_from') return false;
  // Trivial self-edge is a cycle.
  if (srcType === dstType && srcId === dstId) return true;

  const visited = new Set<string>();
  const key = (t: string, id: string) => `${t}:${id}`;
  const stack: Array<{ t: string; id: string }> = [{ t: dstType, id: dstId }];
  const MAX = 2000; // hard cap on traversal
  let steps = 0;

  while (stack.length > 0) {
    if (++steps > MAX) return false; // bail out; treat as no cycle
    const cur = stack.pop()!;
    const k = key(cur.t, cur.id);
    if (visited.has(k)) continue;
    visited.add(k);
    if (cur.t === srcType && cur.id === srcId) return true;

    const rows = await db
      .select({
        dst_type: entityLinks.dst_type,
        dst_id: entityLinks.dst_id,
      })
      .from(entityLinks)
      .where(
        and(
          eq(entityLinks.src_type, cur.t),
          eq(entityLinks.src_id, cur.id),
          sql`${entityLinks.link_kind} = ${kind}::entity_link_kind`,
        ),
      );
    for (const r of rows) {
      stack.push({ t: r.dst_type, id: r.dst_id });
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createLink(params: {
  callerUserId: string;
  orgId: string;
  srcType: string;
  srcId: string;
  dstType: string;
  dstId: string;
  linkKind: LinkKind;
}): Promise<CreateResult> {
  const { callerUserId, orgId, srcType, srcId, dstType, dstId, linkKind } = params;

  if (!isSupportedType(srcType)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_ENTITY_TYPE',
      status: 400,
      message: `src_type '${srcType}' is not in the supported entity-type allowlist`,
      details: [
        {
          field: 'src_type',
          issue: 'unsupported entity type',
          supported: SUPPORTED_ENTITY_TYPES,
        },
      ],
    };
  }
  if (!isSupportedType(dstType)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_ENTITY_TYPE',
      status: 400,
      message: `dst_type '${dstType}' is not in the supported entity-type allowlist`,
      details: [
        {
          field: 'dst_type',
          issue: 'unsupported entity type',
          supported: SUPPORTED_ENTITY_TYPES,
        },
      ],
    };
  }

  // Preflight BOTH sides. We do not short-circuit on the src preflight so the
  // caller can tell from the returned detail which side failed (better UX).
  const [srcPre, dstPre]: [PreflightResult, PreflightResult] = await Promise.all([
    preflightAccess(callerUserId, srcType, srcId),
    preflightAccess(callerUserId, dstType, dstId),
  ]);

  if (!srcPre.allowed) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      status: 403,
      message: 'Caller cannot access src entity',
      preflight: { side: 'src', reason: srcPre.reason },
    };
  }
  if (!dstPre.allowed) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      status: 403,
      message: 'Caller cannot access dst entity',
      preflight: { side: 'dst', reason: dstPre.reason },
    };
  }

  // Cycle guard for DAG kinds.
  if (await wouldCreateCycle(linkKind, srcType, srcId, dstType, dstId)) {
    return {
      ok: false,
      code: 'CYCLE_DETECTED',
      status: 400,
      message: `Creating this ${linkKind} link would introduce a cycle`,
    };
  }

  // Idempotent insert via the unique (src_type, src_id, dst_type, dst_id,
  // link_kind) index. If the row already exists, ON CONFLICT DO NOTHING
  // returns zero rows; we then fetch the existing row and surface
  // `created: false` so the caller can distinguish.
  const inserted = await db
    .insert(entityLinks)
    .values({
      org_id: orgId,
      src_type: srcType,
      src_id: srcId,
      dst_type: dstType,
      dst_id: dstId,
      link_kind: linkKind,
      created_by: callerUserId,
    })
    .onConflictDoNothing({
      target: [
        entityLinks.src_type,
        entityLinks.src_id,
        entityLinks.dst_type,
        entityLinks.dst_id,
        entityLinks.link_kind,
      ],
    })
    .returning();

  if (inserted.length > 0) {
    return { ok: true, created: true, data: normalizeRow(inserted[0]!) };
  }

  const [existing] = await db
    .select()
    .from(entityLinks)
    .where(
      and(
        eq(entityLinks.src_type, srcType),
        eq(entityLinks.src_id, srcId),
        eq(entityLinks.dst_type, dstType),
        eq(entityLinks.dst_id, dstId),
        sql`${entityLinks.link_kind} = ${linkKind}::entity_link_kind`,
      ),
    )
    .limit(1);
  if (!existing) {
    // Extremely unlikely: a racing insert that happened to also CONFLICT.
    // Return a 400 so the caller retries.
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Link insert was a no-op but row is not visible; retry',
    };
  }
  return { ok: true, created: false, data: normalizeRow(existing) };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listLinks(params: {
  callerUserId: string;
  orgId: string;
  type: string;
  id: string;
  direction: 'src' | 'dst' | 'both';
  kind?: LinkKind;
  limit: number;
}): Promise<ListResult> {
  const { callerUserId, orgId, type, id, direction, kind, limit } = params;

  const baseConditions = [eq(entityLinks.org_id, orgId)];
  if (kind) {
    baseConditions.push(sql`${entityLinks.link_kind} = ${kind}::entity_link_kind`);
  }

  // Build direction-scoped where clause. For 'both', we union outbound and
  // inbound with OR.
  let dirCond;
  if (direction === 'src') {
    dirCond = and(eq(entityLinks.src_type, type), eq(entityLinks.src_id, id));
  } else if (direction === 'dst') {
    dirCond = and(eq(entityLinks.dst_type, type), eq(entityLinks.dst_id, id));
  } else {
    dirCond = or(
      and(eq(entityLinks.src_type, type), eq(entityLinks.src_id, id)),
      and(eq(entityLinks.dst_type, type), eq(entityLinks.dst_id, id)),
    );
  }

  const rows = await db
    .select()
    .from(entityLinks)
    .where(and(...baseConditions, dirCond))
    .orderBy(desc(entityLinks.created_at))
    .limit(limit);

  // Per-row visibility filter. We preflight ONLY the "far side" (the side
  // the caller didn't already identify). The side that the caller asked
  // about is implicitly visible since they named it, and re-preflighting
  // it would multiply latency for no signal.
  const visible: EntityLinkRowWithDirection[] = [];
  let filtered = 0;
  for (const raw of rows) {
    const row = normalizeRow(raw);
    const rowDirection: 'outbound' | 'inbound' =
      row.src_type === type && row.src_id === id ? 'outbound' : 'inbound';

    const farType = rowDirection === 'outbound' ? row.dst_type : row.src_type;
    const farId = rowDirection === 'outbound' ? row.dst_id : row.src_id;

    // If the far side is an unsupported type (pre-existing backfill row for
    // bill.*/book.*), skip preflight and just let it through. Agents get
    // visibility on the row via the per-app surfaces instead. This matches
    // the "reads include types without preflight coverage" policy.
    let allowed = true;
    if (isSupportedType(farType)) {
      const pre = await preflightAccess(callerUserId, farType, farId);
      allowed = pre.allowed;
    }

    if (!allowed) {
      filtered += 1;
      continue;
    }
    visible.push({ ...row, direction: rowDirection });
  }

  return { data: visible, filtered_count: filtered };
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

export async function removeLink(params: {
  callerUserId: string;
  orgId: string;
  linkId: string;
}): Promise<RemoveResult> {
  const { callerUserId, orgId, linkId } = params;

  const [row] = await db
    .select()
    .from(entityLinks)
    .where(and(eq(entityLinks.id, linkId), eq(entityLinks.org_id, orgId)))
    .limit(1);

  if (!row) {
    return { ok: false, code: 'NOT_FOUND', status: 404, message: 'Link not found' };
  }

  // Preflight ONE side so the caller can't remove cross-org garbage
  // or a link that touches an entity they can't see. We treat either
  // side being accessible as sufficient to remove.
  const normalized = normalizeRow(row);
  const [srcPre, dstPre] = await Promise.all([
    isSupportedType(normalized.src_type)
      ? preflightAccess(callerUserId, normalized.src_type, normalized.src_id)
      : Promise.resolve({ allowed: false, reason: 'unsupported_entity_type' as const }),
    isSupportedType(normalized.dst_type)
      ? preflightAccess(callerUserId, normalized.dst_type, normalized.dst_id)
      : Promise.resolve({ allowed: false, reason: 'unsupported_entity_type' as const }),
  ]);
  if (!srcPre.allowed && !dstPre.allowed) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      status: 403,
      message: 'Caller cannot access either end of the link',
    };
  }

  await db.delete(entityLinks).where(eq(entityLinks.id, linkId));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRow(raw: typeof entityLinks.$inferSelect): EntityLinkRow {
  return {
    id: raw.id,
    org_id: raw.org_id,
    src_type: raw.src_type,
    src_id: raw.src_id,
    dst_type: raw.dst_type,
    dst_id: raw.dst_id,
    link_kind: raw.link_kind as LinkKind,
    created_by: raw.created_by ?? null,
    created_at: raw.created_at,
  };
}

// Test harness export for unit tests.
export const __test__ = {
  wouldCreateCycle,
  normalizeRow,
};
