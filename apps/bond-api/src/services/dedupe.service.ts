import { and, eq, or, sql, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bondContacts, dedupeDecisions } from '../db/schema/index.js';
import { notFound } from '../lib/utils.js';

/**
 * Bond duplicate-detection service (Wave 5 AGENTIC_TODO §7).
 *
 * Given a source contact, return likely duplicate contacts in the same
 * org ranked by confidence. Signals are:
 *
 *   - email exact (case-insensitive): +0.80 confidence
 *   - phone exact (normalized digits only): +0.70 confidence
 *   - full-name pg_trgm similarity >= min_confidence: similarity score
 *
 * Confidence is clamped to the range [0, 1]. Each candidate row carries
 * the signals that contributed plus, when present, the prior decision
 * row from dedupe_decisions so the caller can suppress pairs a human has
 * already resolved.
 *
 * Preflight: members / viewers only see contacts they own (mirrors
 * listContacts behavior). Org admins and owners see everything in the
 * org. The entity type for dedupe_decisions is 'bond.contact'.
 */

const ENTITY_TYPE = 'bond.contact';

export interface BondDuplicateCandidate {
  contact_id: string;
  confidence: number;
  signals: Array<{ kind: string; detail?: string; score: number }>;
  prior_decision?: {
    decision: 'duplicate' | 'not_duplicate' | 'needs_review';
    decided_at: string;
    decided_by: string;
    reason: string | null;
    resurface_after: string | null;
  };
}

export interface FindDuplicatesResult {
  source_contact_id: string;
  candidates: BondDuplicateCandidate[];
}

export interface FindDuplicatesInput {
  contact_id: string;
  org_id: string;
  limit?: number;
  min_confidence?: number;
  // "Own only" visibility: member / viewer callers only see their own
  // contacts in both the source and the candidate set. Undefined means
  // no ownership restriction (admin / owner callers).
  visibility_owner_id?: string;
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 6 ? digits : null;
}

function fullName(first: string | null | undefined, last: string | null | undefined): string | null {
  const parts = [first, last].map((s) => (s ?? '').trim()).filter((s) => s.length > 0);
  if (parts.length === 0) return null;
  return parts.join(' ');
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function findDuplicateContacts(
  input: FindDuplicatesInput,
): Promise<FindDuplicatesResult> {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const minConfidence = Math.min(Math.max(input.min_confidence ?? 0.3, 0), 1);

  // Load the source contact. Enforce org + own-only visibility so a caller
  // who can't see the source cannot probe for matches.
  const sourceConditions = [
    eq(bondContacts.id, input.contact_id),
    eq(bondContacts.organization_id, input.org_id),
    isNull(bondContacts.deleted_at),
  ];
  if (input.visibility_owner_id) {
    sourceConditions.push(eq(bondContacts.owner_id, input.visibility_owner_id));
  }

  const [source] = await db
    .select({
      id: bondContacts.id,
      first_name: bondContacts.first_name,
      last_name: bondContacts.last_name,
      email: bondContacts.email,
      phone: bondContacts.phone,
      organization_id: bondContacts.organization_id,
    })
    .from(bondContacts)
    .where(and(...sourceConditions))
    .limit(1);

  if (!source) {
    throw notFound('Contact not found');
  }

  const sourceName = fullName(source.first_name, source.last_name);
  const sourcePhone = normalizePhone(source.phone);
  const sourceEmail = source.email ? source.email.trim().toLowerCase() : null;

  // Short-circuit: nothing to match on at all.
  if (!sourceName && !sourcePhone && !sourceEmail) {
    return { source_contact_id: source.id, candidates: [] };
  }

  // Build candidate pool via a single SQL scan. pg_trgm similarity is
  // computed server-side so we only fetch rows that clear a loose name
  // bar (0.15 trgm or email/phone hit). Final ranking is done in JS so
  // we can combine multiple signals with tiered weights.
  //
  // We use an inline SQL CAST on concat(first, ' ', last) so the match
  // survives missing first OR last names.
  const conditions = [
    eq(bondContacts.organization_id, input.org_id),
    isNull(bondContacts.deleted_at),
    sql`${bondContacts.id} <> ${source.id}`,
  ];
  if (input.visibility_owner_id) {
    conditions.push(eq(bondContacts.owner_id, input.visibility_owner_id));
  }

  // signal filter: name trgm OR email exact OR phone exact
  const filters: ReturnType<typeof or>[] = [];
  if (sourceName) {
    filters.push(
      sql`similarity(lower(coalesce(${bondContacts.first_name}, '') || ' ' || coalesce(${bondContacts.last_name}, '')), lower(${sourceName})) >= 0.15`,
    );
  }
  if (sourceEmail) {
    filters.push(sql`lower(${bondContacts.email}) = ${sourceEmail}`);
  }
  if (sourcePhone) {
    filters.push(
      sql`regexp_replace(coalesce(${bondContacts.phone}, ''), '\\D', '', 'g') = ${sourcePhone}`,
    );
  }
  if (filters.length === 0) {
    return { source_contact_id: source.id, candidates: [] };
  }
  conditions.push(or(...filters)!);

  const nameSimSql = sourceName
    ? sql<number>`similarity(lower(coalesce(${bondContacts.first_name}, '') || ' ' || coalesce(${bondContacts.last_name}, '')), lower(${sourceName}))`
    : sql<number>`0::float4`;

  const candidates = await db
    .select({
      id: bondContacts.id,
      first_name: bondContacts.first_name,
      last_name: bondContacts.last_name,
      email: bondContacts.email,
      phone: bondContacts.phone,
      name_sim: nameSimSql,
    })
    .from(bondContacts)
    .where(and(...conditions))
    .limit(200);

  // Score each candidate by combining signal weights. The highest
  // weighted signal dominates; additional signals nudge it up a little.
  const scored: BondDuplicateCandidate[] = [];
  for (const c of candidates) {
    const signals: Array<{ kind: string; detail?: string; score: number }> = [];
    let confidence = 0;

    if (sourceEmail && c.email && c.email.trim().toLowerCase() === sourceEmail) {
      signals.push({ kind: 'email_exact', detail: sourceEmail, score: 0.8 });
      confidence = Math.max(confidence, 0.8);
    }
    if (sourcePhone) {
      const cPhone = normalizePhone(c.phone);
      if (cPhone && cPhone === sourcePhone) {
        signals.push({ kind: 'phone_exact', detail: sourcePhone, score: 0.7 });
        confidence = Math.max(confidence, 0.7);
      }
    }
    if (sourceName && Number(c.name_sim) > 0) {
      const sim = Number(c.name_sim);
      signals.push({ kind: 'name_trgm', detail: fullName(c.first_name, c.last_name) ?? '', score: sim });
      if (sim > confidence) confidence = sim;
      else if (confidence > 0 && sim >= 0.3) {
        // Secondary name signal nudges confidence up but caps at 0.95.
        confidence = Math.min(0.95, confidence + sim * 0.1);
      }
    }

    if (signals.length === 0) continue;
    if (confidence < minConfidence) continue;
    scored.push({ contact_id: c.id, confidence: Math.min(confidence, 1), signals });
  }

  scored.sort((a, b) => b.confidence - a.confidence);
  const trimmed = scored.slice(0, limit);

  // Enrich with prior decisions. Canonical ordered pair lookup.
  if (trimmed.length > 0) {
    const pairs = trimmed.map((c) => orderedPair(source.id, c.contact_id));
    const rows = await db
      .select({
        id_a: dedupeDecisions.id_a,
        id_b: dedupeDecisions.id_b,
        decision: dedupeDecisions.decision,
        decided_at: dedupeDecisions.decided_at,
        decided_by: dedupeDecisions.decided_by,
        reason: dedupeDecisions.reason,
        resurface_after: dedupeDecisions.resurface_after,
      })
      .from(dedupeDecisions)
      .where(
        and(
          eq(dedupeDecisions.org_id, input.org_id),
          eq(dedupeDecisions.entity_type, ENTITY_TYPE),
          or(
            ...pairs.map(
              ([a, b]) =>
                and(eq(dedupeDecisions.id_a, a), eq(dedupeDecisions.id_b, b))!,
            ),
          )!,
        ),
      );

    const byPair = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      byPair.set(`${r.id_a}:${r.id_b}`, r);
    }
    for (const cand of trimmed) {
      const [a, b] = orderedPair(source.id, cand.contact_id);
      const row = byPair.get(`${a}:${b}`);
      if (row) {
        cand.prior_decision = {
          decision: row.decision as 'duplicate' | 'not_duplicate' | 'needs_review',
          decided_at: row.decided_at.toISOString(),
          decided_by: row.decided_by,
          reason: row.reason,
          resurface_after: row.resurface_after ? row.resurface_after.toISOString() : null,
        };
      }
    }
  }

  return { source_contact_id: source.id, candidates: trimmed };
}
