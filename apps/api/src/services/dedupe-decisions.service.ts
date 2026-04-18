import { and, desc, eq, or, sql, lte, gte, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dedupeDecisions } from '../db/schema/dedupe-decisions.js';
import { users } from '../db/schema/users.js';

/**
 * Cross-app dedupe-decision service (Wave 5 AGENTIC_TODO §7).
 *
 * Canonical ordered-pair semantics:
 *   - Every row stores (id_a, id_b) with id_a < id_b. Callers pass any
 *     two ids; this service sorts them before insert / lookup.
 *
 * Human-vs-agent precedence:
 *   - When an AGENT caller records a decision and a human has already
 *     recorded one for the same pair, the agent write is REJECTED with
 *     a `prior_decision` payload so the caller can surface the human
 *     verdict instead of quietly overwriting it.
 *   - Humans can always record (they overwrite via ON CONFLICT, since
 *     a human's updated decision supersedes whatever was there).
 *   - Service callers follow the human rule (overwrite) on the theory
 *     that service-account invocations come from deliberate ops flows.
 *
 * `dedupe_list_pending` is a friendly name for "show me pairs that are
 * not `not_duplicate` AND whose resurface_after has elapsed (or is
 * null meaning always pending review)". It's the inverse of the
 * suppression check the per-app find tools do.
 */

export const DEDUPE_DECISION_VALUES = ['duplicate', 'not_duplicate', 'needs_review'] as const;
export type DedupeDecisionValue = (typeof DEDUPE_DECISION_VALUES)[number];

export interface DedupeDecisionRow {
  id: string;
  org_id: string;
  entity_type: string;
  id_a: string;
  id_b: string;
  decision: DedupeDecisionValue;
  decided_by: string;
  decided_at: string;
  reason: string | null;
  confidence_at_decision: number | null;
  resurface_after: string | null;
  created_at: string;
}

export interface RecordDecisionInput {
  org_id: string;
  actor_user_id: string;
  entity_type: string;
  id_a: string;
  id_b: string;
  decision: DedupeDecisionValue;
  reason?: string;
  confidence?: number;
  resurface_after?: Date | null;
}

export type RecordDecisionResult =
  | { ok: true; data: DedupeDecisionRow; created: boolean }
  | {
      ok: false;
      code: 'ORDERED_PAIR_EQUAL' | 'HUMAN_DECISION_EXISTS';
      status: 400 | 409;
      message: string;
      prior_decision?: DedupeDecisionRow;
    };

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function rowToDto(row: typeof dedupeDecisions.$inferSelect): DedupeDecisionRow {
  return {
    id: row.id,
    org_id: row.org_id,
    entity_type: row.entity_type,
    id_a: row.id_a,
    id_b: row.id_b,
    decision: row.decision as DedupeDecisionValue,
    decided_by: row.decided_by,
    decided_at: row.decided_at.toISOString(),
    reason: row.reason,
    confidence_at_decision: row.confidence_at_decision !== null ? Number(row.confidence_at_decision) : null,
    resurface_after: row.resurface_after ? row.resurface_after.toISOString() : null,
    created_at: row.created_at.toISOString(),
  };
}

async function loadActorKind(userId: string): Promise<'human' | 'agent' | 'service' | null> {
  const [row] = await db
    .select({ kind: users.kind })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return (row?.kind as 'human' | 'agent' | 'service' | undefined) ?? null;
}

export async function recordDecision(input: RecordDecisionInput): Promise<RecordDecisionResult> {
  if (input.id_a === input.id_b) {
    return {
      ok: false,
      code: 'ORDERED_PAIR_EQUAL',
      status: 400,
      message: 'Cannot record a dedupe decision where id_a equals id_b',
    };
  }

  const [idA, idB] = canonicalPair(input.id_a, input.id_b);
  const actorKind = await loadActorKind(input.actor_user_id);

  // Probe for an existing row in the canonical ordering.
  const [existing] = await db
    .select()
    .from(dedupeDecisions)
    .where(
      and(
        eq(dedupeDecisions.org_id, input.org_id),
        eq(dedupeDecisions.entity_type, input.entity_type),
        eq(dedupeDecisions.id_a, idA),
        eq(dedupeDecisions.id_b, idB),
      ),
    )
    .limit(1);

  // Agent block: if a human already decided this pair, agents can't overwrite.
  if (existing && actorKind === 'agent') {
    const [priorActor] = await db
      .select({ kind: users.kind })
      .from(users)
      .where(eq(users.id, existing.decided_by))
      .limit(1);
    if (priorActor?.kind === 'human') {
      return {
        ok: false,
        code: 'HUMAN_DECISION_EXISTS',
        status: 409,
        message:
          'A human has already recorded a decision for this pair. Agents cannot overwrite human decisions.',
        prior_decision: rowToDto(existing),
      };
    }
  }

  if (existing) {
    const [updated] = await db
      .update(dedupeDecisions)
      .set({
        decision: input.decision,
        decided_by: input.actor_user_id,
        decided_at: new Date(),
        reason: input.reason ?? null,
        confidence_at_decision: input.confidence !== undefined ? String(input.confidence) : null,
        resurface_after: input.resurface_after ?? null,
      })
      .where(eq(dedupeDecisions.id, existing.id))
      .returning();
    return { ok: true, data: rowToDto(updated), created: false };
  }

  const [inserted] = await db
    .insert(dedupeDecisions)
    .values({
      org_id: input.org_id,
      entity_type: input.entity_type,
      id_a: idA,
      id_b: idB,
      decision: input.decision,
      decided_by: input.actor_user_id,
      reason: input.reason ?? null,
      confidence_at_decision: input.confidence !== undefined ? String(input.confidence) : null,
      resurface_after: input.resurface_after ?? null,
    })
    .returning();
  return { ok: true, data: rowToDto(inserted), created: true };
}

export interface ListPendingInput {
  org_id: string;
  entity_type?: string;
  since?: Date;
  limit?: number;
}

export async function listPending(input: ListPendingInput): Promise<{ data: DedupeDecisionRow[] }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const now = new Date();

  const conditions = [
    eq(dedupeDecisions.org_id, input.org_id),
    // "Pending" means either (a) marked needs_review, or (b) marked
    // duplicate / not_duplicate but the resurface window has elapsed.
    or(
      eq(dedupeDecisions.decision, 'needs_review'),
      and(
        sql`${dedupeDecisions.resurface_after} IS NOT NULL`,
        lte(dedupeDecisions.resurface_after, now),
      )!,
    )!,
  ];
  if (input.entity_type) {
    conditions.push(eq(dedupeDecisions.entity_type, input.entity_type));
  }
  if (input.since) {
    conditions.push(gte(dedupeDecisions.decided_at, input.since));
  }

  const rows = await db
    .select()
    .from(dedupeDecisions)
    .where(and(...conditions))
    .orderBy(desc(dedupeDecisions.decided_at))
    .limit(limit);

  return { data: rows.map(rowToDto) };
}

export async function getDecision(
  orgId: string,
  entityType: string,
  idA: string,
  idB: string,
): Promise<DedupeDecisionRow | null> {
  const [a, b] = canonicalPair(idA, idB);
  const [row] = await db
    .select()
    .from(dedupeDecisions)
    .where(
      and(
        eq(dedupeDecisions.org_id, orgId),
        eq(dedupeDecisions.entity_type, entityType),
        eq(dedupeDecisions.id_a, a),
        eq(dedupeDecisions.id_b, b),
      ),
    )
    .limit(1);
  return row ? rowToDto(row) : null;
}

/**
 * Exported for tests.
 */
export const __test__ = {
  canonicalPair,
  loadActorKind,
};
