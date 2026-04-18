// ---------------------------------------------------------------------------
// expertise-for-topic service (AGENTIC_TODO §8 Wave 5)
//
// Live cross-app aggregator: given a free-text topic query, returns the
// top-ranked experts across Beacon ownership, Bam task activity, Brief
// authorship, and Bond coverage. Default weights:
//   beacon=3.0, bam=1.0, brief=2.0, bond=2.0
//
// Per-entity contribution is dampened by a time-decay half life
// (default 90 days) applied to the entity's last-touched timestamp,
// so a beacon entry owned two half-lives ago contributes 1/4 as much as
// one touched today.
//
// Evidence preflight:
//   The raw aggregation computes scores AND collects up to N evidence
//   entities per source. Before returning, each evidence row is passed
//   through preflightAccess(asker_user_id) and dropped if not allowed;
//   the score is preserved (the evidence contributed to the number, even
//   if we do not expose it to this asker).
//
// Scope:
//   - Caller's active_org_id bounds every query.
//   - Caller MUST pass asker_user_id (typically the caller's own id, but
//     agents running on behalf of a human pass the human's id).
// ---------------------------------------------------------------------------

import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/users.js';
import {
  beaconEntriesStub,
  briefDocumentsStub,
  bondDealsStub,
  bondContactsStub,
} from '../db/schema/peer-app-stubs/index.js';
import { preflightAccess } from './visibility.service.js';

export type ExpertiseSourceKind = 'beacon' | 'bam' | 'brief' | 'bond';

export interface ExpertiseWeights {
  beacon?: number;
  bam?: number;
  brief?: number;
  bond?: number;
}

export const DEFAULT_WEIGHTS: Required<ExpertiseWeights> = {
  beacon: 3.0,
  bam: 1.0,
  brief: 2.0,
  bond: 2.0,
};

export const DEFAULT_HALF_LIFE_DAYS = 90;
export const MAX_EVIDENCE_PER_SOURCE = 5;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

export interface ExpertiseEvidence {
  entity_type: string;
  entity_id: string;
  title: string;
  url: string;
}

export interface ExpertiseSignal {
  source: ExpertiseSourceKind;
  weight: number;
  evidence: ExpertiseEvidence[];
}

export interface ExpertiseExpert {
  user_id: string;
  name: string;
  email: string;
  score: number;
  signals: ExpertiseSignal[];
}

export interface ExpertiseResult {
  topic: string;
  experts: ExpertiseExpert[];
}

export interface ExpertiseQuery {
  topic_query: string;
  asker_user_id: string;
  org_id: string;
  signal_weights?: ExpertiseWeights;
  limit?: number;
  time_decay_half_life_days?: number;
  /** For tests: pin "now" so decay is deterministic. */
  now?: Date;
}

export class ExpertiseError extends Error {
  code: string;
  statusCode: number;
  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'ExpertiseError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Compute the time-decay factor for a single evidence event given its
 * timestamp and the half-life. Returns 1.0 for "now" and 0.5 at 1x half-life.
 * Guards against negative deltas (clock skew / future dates -> clamp to 1.0).
 */
export function decayFactor(
  eventAt: Date,
  now: Date,
  halfLifeDays: number,
): number {
  if (halfLifeDays <= 0) return 1;
  const deltaMs = now.getTime() - eventAt.getTime();
  if (deltaMs <= 0) return 1;
  const ageDays = deltaMs / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function resolveWeights(w: ExpertiseWeights | undefined): Required<ExpertiseWeights> {
  if (!w) return DEFAULT_WEIGHTS;
  return {
    beacon: Number.isFinite(w.beacon) ? Math.max(0, w.beacon!) : DEFAULT_WEIGHTS.beacon,
    bam: Number.isFinite(w.bam) ? Math.max(0, w.bam!) : DEFAULT_WEIGHTS.bam,
    brief: Number.isFinite(w.brief) ? Math.max(0, w.brief!) : DEFAULT_WEIGHTS.brief,
    bond: Number.isFinite(w.bond) ? Math.max(0, w.bond!) : DEFAULT_WEIGHTS.bond,
  };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

// ---------------------------------------------------------------------------
// Accumulator
// ---------------------------------------------------------------------------

interface AccEntry {
  user_id: string;
  score: number;
  perSource: Map<
    ExpertiseSourceKind,
    { weight: number; evidence: Array<ExpertiseEvidence & { eventAt: Date }> }
  >;
}

function ensureEntry(acc: Map<string, AccEntry>, user_id: string): AccEntry {
  let entry = acc.get(user_id);
  if (!entry) {
    entry = { user_id, score: 0, perSource: new Map() };
    acc.set(user_id, entry);
  }
  return entry;
}

function addSignal(
  acc: Map<string, AccEntry>,
  user_id: string,
  source: ExpertiseSourceKind,
  weight: number,
  evidence: ExpertiseEvidence,
  eventAt: Date,
  now: Date,
  halfLifeDays: number,
): void {
  const factor = decayFactor(eventAt, now, halfLifeDays);
  const contribution = weight * factor;
  if (contribution <= 0) return;
  const entry = ensureEntry(acc, user_id);
  entry.score += contribution;
  let bucket = entry.perSource.get(source);
  if (!bucket) {
    bucket = { weight, evidence: [] };
    entry.perSource.set(source, bucket);
  }
  bucket.evidence.push({ ...evidence, eventAt });
}

// ---------------------------------------------------------------------------
// Per-source fetchers
// ---------------------------------------------------------------------------

const MAX_ROWS_PER_SOURCE = 200;

interface BeaconRow {
  id: string;
  title: string;
  owned_by: string;
  updated_at: Date;
}

async function fetchBeaconSignals(
  topic: string,
  orgId: string,
): Promise<BeaconRow[]> {
  // Beacon uses a functional GIN index on title+summary+body_markdown
  // (migration 0023). We replicate that tsvector expression here and
  // cap the row count. Owned_by is the ownership signal.
  const rows = (await db.execute(sql`
    SELECT id, title, owned_by, updated_at
      FROM beacon_entries
     WHERE organization_id = ${orgId}::uuid
       AND retired_at IS NULL
       AND to_tsvector('english',
                       coalesce(title, '') || ' ' ||
                       coalesce(summary, '') || ' ' ||
                       coalesce(body_markdown, ''))
           @@ plainto_tsquery('english', ${topic})
     ORDER BY updated_at DESC
     LIMIT ${MAX_ROWS_PER_SOURCE}
  `)) as unknown as Array<{
    id: string;
    title: string;
    owned_by: string;
    updated_at: Date | string;
  }>;
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    owned_by: String(r.owned_by),
    updated_at: r.updated_at instanceof Date ? r.updated_at : new Date(String(r.updated_at)),
  }));
}

interface BamTaskRow {
  id: string;
  title: string;
  assignee_id: string;
  updated_at: Date;
}

async function fetchBamTaskSignals(
  topic: string,
  orgId: string,
): Promise<BamTaskRow[]> {
  const rows = (await db.execute(sql`
    SELECT t.id, t.title, t.assignee_id, t.updated_at
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
     WHERE p.org_id = ${orgId}::uuid
       AND t.assignee_id IS NOT NULL
       AND (
             to_tsvector('english', coalesce(t.title, '')) @@ plainto_tsquery('english', ${topic})
          OR to_tsvector('english', coalesce(t.description_plain, '')) @@ plainto_tsquery('english', ${topic})
       )
     ORDER BY t.updated_at DESC
     LIMIT ${MAX_ROWS_PER_SOURCE}
  `)) as unknown as Array<{
    id: string;
    title: string;
    assignee_id: string;
    updated_at: Date | string;
  }>;
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    assignee_id: String(r.assignee_id),
    updated_at: r.updated_at instanceof Date ? r.updated_at : new Date(String(r.updated_at)),
  }));
}

interface BriefRow {
  id: string;
  title: string;
  created_by: string;
  updated_at: Date;
}

async function fetchBriefSignals(
  topic: string,
  orgId: string,
): Promise<BriefRow[]> {
  // Brief has a functional GIN index on title+plain_text (migration 0024).
  const rows = (await db.execute(sql`
    SELECT id, title, created_by, updated_at
      FROM brief_documents
     WHERE org_id = ${orgId}::uuid
       AND to_tsvector('english',
                       coalesce(title, '') || ' ' || coalesce(plain_text, ''))
           @@ plainto_tsquery('english', ${topic})
     ORDER BY updated_at DESC
     LIMIT ${MAX_ROWS_PER_SOURCE}
  `)) as unknown as Array<{
    id: string;
    title: string;
    created_by: string;
    updated_at: Date | string;
  }>;
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    created_by: String(r.created_by),
    updated_at: r.updated_at instanceof Date ? r.updated_at : new Date(String(r.updated_at)),
  }));
}

interface BondRow {
  id: string;
  kind: 'deal' | 'contact';
  title: string;
  owner_id: string;
  updated_at: Date;
}

async function fetchBondSignals(
  topic: string,
  orgId: string,
): Promise<BondRow[]> {
  // Bond does not have a generated search_vector; fall back to ILIKE on
  // name/description. This is adequate for topic-flavored coverage signals
  // and keeps the service from depending on a migration not yet in tree.
  const like = `%${topic.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const dealRows = (await db.execute(sql`
    SELECT id, coalesce(name, '(unnamed)') AS title, owner_id, updated_at
      FROM bond_deals
     WHERE organization_id = ${orgId}::uuid
       AND deleted_at IS NULL
       AND owner_id IS NOT NULL
       AND (name ILIKE ${like} OR description ILIKE ${like})
     ORDER BY updated_at DESC
     LIMIT ${MAX_ROWS_PER_SOURCE}
  `)) as unknown as Array<{
    id: string;
    title: string;
    owner_id: string;
    updated_at: Date | string;
  }>;
  const contactRows = (await db.execute(sql`
    SELECT id,
           coalesce(first_name, '') || ' ' || coalesce(last_name, '') AS title,
           owner_id,
           updated_at
      FROM bond_contacts
     WHERE organization_id = ${orgId}::uuid
       AND deleted_at IS NULL
       AND owner_id IS NOT NULL
       AND (
             coalesce(first_name, '') ILIKE ${like}
          OR coalesce(last_name, '') ILIKE ${like}
          OR coalesce(email, '') ILIKE ${like}
          OR coalesce(title, '') ILIKE ${like}
       )
     ORDER BY updated_at DESC
     LIMIT ${MAX_ROWS_PER_SOURCE}
  `)) as unknown as Array<{
    id: string;
    title: string;
    owner_id: string;
    updated_at: Date | string;
  }>;
  const normalize = (rows: typeof dealRows, kind: 'deal' | 'contact'): BondRow[] =>
    (rows ?? []).map((r) => ({
      id: String(r.id),
      kind,
      title: String(r.title || '(unnamed)').trim() || '(unnamed)',
      owner_id: String(r.owner_id),
      updated_at: r.updated_at instanceof Date ? r.updated_at : new Date(String(r.updated_at)),
    }));
  return [...normalize(dealRows, 'deal'), ...normalize(contactRows, 'contact')];
}

// ---------------------------------------------------------------------------
// Evidence URL conventions
// ---------------------------------------------------------------------------
//
// The composite views use `/<app>/<type>/<id>` relative paths. We follow
// the same pattern so the returned `url` field is stable.

function beaconUrl(id: string): string {
  return `/beacon/entries/${id}`;
}
function taskUrl(id: string): string {
  return `/b3/tasks/${id}`;
}
function briefUrl(id: string): string {
  return `/brief/documents/${id}`;
}
function dealUrl(id: string): string {
  return `/bond/deals/${id}`;
}
function contactUrl(id: string): string {
  return `/bond/contacts/${id}`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function expertiseForTopic(
  q: ExpertiseQuery,
): Promise<ExpertiseResult> {
  if (!q.topic_query || q.topic_query.trim().length === 0) {
    throw new ExpertiseError('INVALID_TOPIC', 'topic_query must be non-empty');
  }
  if (!q.asker_user_id) {
    throw new ExpertiseError('ASKER_REQUIRED', 'asker_user_id is required');
  }
  if (!q.org_id) {
    throw new ExpertiseError('ORG_REQUIRED', 'org_id is required');
  }

  const weights = resolveWeights(q.signal_weights);
  const halfLifeDays =
    q.time_decay_half_life_days !== undefined && q.time_decay_half_life_days > 0
      ? q.time_decay_half_life_days
      : DEFAULT_HALF_LIFE_DAYS;
  const limit = clampLimit(q.limit);
  const now = q.now ?? new Date();

  // Fetch all four sources in parallel. Failures degrade gracefully: a
  // source that throws contributes no signals, but the aggregate still
  // returns. (Logged via the caller.)
  const [beacon, bam, brief, bond] = await Promise.allSettled([
    fetchBeaconSignals(q.topic_query, q.org_id),
    fetchBamTaskSignals(q.topic_query, q.org_id),
    fetchBriefSignals(q.topic_query, q.org_id),
    fetchBondSignals(q.topic_query, q.org_id),
  ]);

  const acc = new Map<string, AccEntry>();

  if (beacon.status === 'fulfilled') {
    for (const row of beacon.value) {
      addSignal(
        acc,
        row.owned_by,
        'beacon',
        weights.beacon,
        {
          entity_type: 'beacon.entry',
          entity_id: row.id,
          title: row.title,
          url: beaconUrl(row.id),
        },
        row.updated_at,
        now,
        halfLifeDays,
      );
    }
  }

  if (bam.status === 'fulfilled') {
    for (const row of bam.value) {
      addSignal(
        acc,
        row.assignee_id,
        'bam',
        weights.bam,
        {
          entity_type: 'bam.task',
          entity_id: row.id,
          title: row.title,
          url: taskUrl(row.id),
        },
        row.updated_at,
        now,
        halfLifeDays,
      );
    }
  }

  if (brief.status === 'fulfilled') {
    for (const row of brief.value) {
      addSignal(
        acc,
        row.created_by,
        'brief',
        weights.brief,
        {
          entity_type: 'brief.document',
          entity_id: row.id,
          title: row.title,
          url: briefUrl(row.id),
        },
        row.updated_at,
        now,
        halfLifeDays,
      );
    }
  }

  if (bond.status === 'fulfilled') {
    for (const row of bond.value) {
      const entity_type = row.kind === 'deal' ? 'bond.deal' : 'bond.contact';
      const url = row.kind === 'deal' ? dealUrl(row.id) : contactUrl(row.id);
      addSignal(
        acc,
        row.owner_id,
        'bond',
        weights.bond,
        { entity_type, entity_id: row.id, title: row.title, url },
        row.updated_at,
        now,
        halfLifeDays,
      );
    }
  }

  // Pick the top-N users by score.
  const ranked = [...acc.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (ranked.length === 0) {
    return { topic: q.topic_query, experts: [] };
  }

  // Hydrate user metadata.
  const userIds = ranked.map((r) => r.user_id);
  const userRows = await db
    .select({ id: users.id, email: users.email, display_name: users.display_name })
    .from(users)
    .where(sql`${users.id} = ANY(${userIds}::uuid[])`);
  const userMeta = new Map(userRows.map((u) => [u.id, u]));

  // Preflight evidence per expert. Strip entities the asker cannot see;
  // score is preserved because the evidence counted toward it.
  const experts: ExpertiseExpert[] = [];
  for (const entry of ranked) {
    const meta = userMeta.get(entry.user_id);
    if (!meta) continue;
    const signals: ExpertiseSignal[] = [];
    for (const [source, bucket] of entry.perSource) {
      // Sort evidence by recency and trim to MAX_EVIDENCE_PER_SOURCE BEFORE
      // preflighting, so we do not waste preflight checks on long tails.
      const sorted = [...bucket.evidence].sort(
        (a, b) => b.eventAt.getTime() - a.eventAt.getTime(),
      );
      const candidates = sorted.slice(0, MAX_EVIDENCE_PER_SOURCE);
      const visible: ExpertiseEvidence[] = [];
      for (const ev of candidates) {
        try {
          const flight = await preflightAccess(
            q.asker_user_id,
            ev.entity_type,
            ev.entity_id,
          );
          if (flight.allowed) {
            visible.push({
              entity_type: ev.entity_type,
              entity_id: ev.entity_id,
              title: ev.title,
              url: ev.url,
            });
          }
        } catch {
          // Preflight failure -> drop this evidence row. Score is already
          // counted; we just do not expose it.
        }
      }
      signals.push({ source, weight: bucket.weight, evidence: visible });
    }
    experts.push({
      user_id: entry.user_id,
      name: meta.display_name,
      email: meta.email,
      score: Math.round(entry.score * 1000) / 1000,
      signals: signals.sort((a, b) => b.weight - a.weight),
    });
  }

  return { topic: q.topic_query, experts };
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export const __test__ = {
  decayFactor,
  resolveWeights,
  clampLimit,
  addSignal,
  ensureEntry,
};

// Silence unused-import warnings for stubs that documentation-only mirrors
// the physical tables. We use raw SQL above so the stub imports are not
// otherwise referenced; keep them so a future refactor to the Drizzle
// query builder has the types handy.
void beaconEntriesStub;
void briefDocumentsStub;
void bondDealsStub;
void bondContactsStub;
