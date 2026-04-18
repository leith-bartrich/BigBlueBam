import { and, eq, or, sql, ne, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tickets, projects, dedupeDecisions } from '../db/schema/index.js';

/**
 * Helpdesk similar-tickets service (Wave 5 AGENTIC_TODO §7).
 *
 * Given a source ticket, return similar tickets in the same org ranked
 * by confidence. Signals:
 *   - subject pg_trgm similarity (word-based): sim score, requires >= 0.2
 *   - same helpdesk_user (requester): +0.15
 *   - same category: +0.10
 *   - already linked via tickets.duplicate_of: +0.25
 *
 * Final confidence is clamped to [0, 1]. Each candidate carries the
 * signals that contributed plus, when present, any prior decision row
 * from dedupe_decisions keyed by the canonical ordered pair.
 *
 * Preflight: the caller's org is resolved upstream; we only return
 * tickets whose project.org_id matches it. Members in the helpdesk
 * portal are not exposed to this surface (agent-routes only).
 */

const ENTITY_TYPE = 'helpdesk.ticket';

export interface SimilarTicketCandidate {
  ticket_id: string;
  ticket_number: number | null;
  subject: string;
  status: string;
  confidence: number;
  similarity_signals: Array<{ kind: string; detail?: string; score: number }>;
  prior_decision?: {
    decision: 'duplicate' | 'not_duplicate' | 'needs_review';
    decided_at: string;
    decided_by: string;
    reason: string | null;
    resurface_after: string | null;
  };
}

export interface SimilarTicketsResult {
  source_ticket_id: string;
  candidates: SimilarTicketCandidate[];
}

export interface FindSimilarTicketsInput {
  ticket_id: string;
  org_id: string;
  status_filter?: 'open' | 'any' | 'not_closed';
  limit?: number;
  window_days?: number;
  min_confidence?: number;
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export class SimilarTicketsError extends Error {
  public statusCode: number;
  public code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'SimilarTicketsError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function findSimilarTickets(
  input: FindSimilarTicketsInput,
): Promise<SimilarTicketsResult> {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const minConfidence = Math.min(Math.max(input.min_confidence ?? 0.25, 0), 1);
  const windowDays = input.window_days !== undefined ? Math.max(1, Math.min(365, input.window_days)) : null;
  const statusFilter = input.status_filter ?? 'not_closed';

  // Load source ticket org-scoped. We fail with 404 if the ticket isn't
  // in the caller's org so a probe from a foreign org is indistinguishable
  // from a genuinely missing ticket.
  const [source] = await db
    .select({
      id: tickets.id,
      subject: tickets.subject,
      category: tickets.category,
      helpdesk_user_id: tickets.helpdesk_user_id,
      project_id: tickets.project_id,
      duplicate_of: tickets.duplicate_of,
      org_id: projects.org_id,
    })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.project_id))
    .where(and(eq(tickets.id, input.ticket_id), eq(projects.org_id, input.org_id)))
    .limit(1);

  if (!source) {
    throw new SimilarTicketsError(404, 'NOT_FOUND', 'Ticket not found');
  }

  const sourceSubject = (source.subject ?? '').trim();
  if (sourceSubject.length === 0) {
    return { source_ticket_id: source.id, candidates: [] };
  }

  const conditions: ReturnType<typeof eq>[] = [
    eq(projects.org_id, input.org_id),
    ne(tickets.id, source.id),
  ];

  if (statusFilter === 'open') {
    conditions.push(eq(tickets.status, 'open'));
  } else if (statusFilter === 'not_closed') {
    conditions.push(sql`${tickets.status} <> 'closed'` as unknown as ReturnType<typeof eq>);
  }

  if (windowDays !== null) {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    conditions.push(gte(tickets.created_at, cutoff));
  }

  // Loose trgm filter to keep the candidate pool small. Final scoring
  // happens below.
  const trgmFilter = sql`similarity(lower(${tickets.subject}), lower(${sourceSubject})) >= 0.2`;
  conditions.push(trgmFilter as unknown as ReturnType<typeof eq>);

  const rows = await db
    .select({
      id: tickets.id,
      ticket_number: tickets.ticket_number,
      subject: tickets.subject,
      status: tickets.status,
      category: tickets.category,
      helpdesk_user_id: tickets.helpdesk_user_id,
      duplicate_of: tickets.duplicate_of,
      subject_sim: sql<number>`similarity(lower(${tickets.subject}), lower(${sourceSubject}))`,
    })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.project_id))
    .where(and(...conditions))
    .limit(200);

  const scored: SimilarTicketCandidate[] = [];
  for (const r of rows) {
    const signals: Array<{ kind: string; detail?: string; score: number }> = [];
    let confidence = 0;

    const sim = Number(r.subject_sim);
    if (sim > 0) {
      signals.push({ kind: 'subject_trgm', detail: r.subject, score: sim });
      confidence = sim;
    }

    if (r.helpdesk_user_id && r.helpdesk_user_id === source.helpdesk_user_id) {
      signals.push({ kind: 'same_requester', score: 0.15 });
      confidence = Math.min(1, confidence + 0.15);
    }
    if (source.category && r.category && r.category === source.category) {
      signals.push({ kind: 'same_category', detail: r.category, score: 0.1 });
      confidence = Math.min(1, confidence + 0.1);
    }
    if (
      (r.duplicate_of && r.duplicate_of === source.id) ||
      (source.duplicate_of && source.duplicate_of === r.id)
    ) {
      signals.push({ kind: 'linked_duplicate', score: 0.25 });
      confidence = Math.min(1, confidence + 0.25);
    }

    if (signals.length === 0) continue;
    if (confidence < minConfidence) continue;

    scored.push({
      ticket_id: r.id,
      ticket_number: r.ticket_number,
      subject: r.subject,
      status: r.status,
      confidence: Math.min(confidence, 1),
      similarity_signals: signals,
    });
  }

  scored.sort((a, b) => b.confidence - a.confidence);
  const trimmed = scored.slice(0, limit);

  // Enrich with prior decisions. Canonical ordered pair lookup.
  if (trimmed.length > 0) {
    const pairs = trimmed.map((c) => orderedPair(source.id, c.ticket_id));
    const decisions = await db
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

    const byPair = new Map<string, (typeof decisions)[number]>();
    for (const d of decisions) {
      byPair.set(`${d.id_a}:${d.id_b}`, d);
    }
    for (const cand of trimmed) {
      const [a, b] = orderedPair(source.id, cand.ticket_id);
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

  return { source_ticket_id: source.id, candidates: trimmed };
}
