// ---------------------------------------------------------------------------
// beacon_upsert_by_slug service (AGENTIC_TODO §14 Wave 4)
//
// Idempotent create-or-update on `slug` (globally unique, enforced by the
// existing `.unique().notNull()` declaration on beaconEntries.slug). Update
// path bumps `version` to match existing `beacon_update` behavior and writes
// a new `beacon_versions` snapshot.
//
// Response envelope: `{ data, created, idempotency_key }`. The idempotency
// key is `slug:<slug>` so log lines for retried webhooks collate.
// ---------------------------------------------------------------------------

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { beaconEntries, beaconVersions } from '../db/schema/index.js';
import { sanitizeHtml } from '../lib/sanitize.js';

export class EntryUpsertError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'EntryUpsertError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface EntryUpsertInput {
  slug: string;
  title: string;
  summary?: string | null;
  body_markdown: string;
  body_html?: string | null;
  visibility?: 'Public' | 'Organization' | 'Project' | 'Private';
  project_id?: string | null;
  metadata?: Record<string, unknown>;
  /** Human-friendly note attached to the new version row on update. */
  change_note?: string | null;
}

export interface EntryUpsertResult {
  data: typeof beaconEntries.$inferSelect;
  created: boolean;
  idempotency_key: string;
}

/**
 * Resolve the effective default_expiry_days for a new beacon. Inlined here
 * rather than imported from beacon.service.ts to keep the upsert path
 * self-contained. Falls back to 90 days when no org-level override exists.
 */
async function resolveDefaultExpiryDays(orgId: string): Promise<number> {
  const rows = (await db.execute(
    sql`SELECT default_expiry_days FROM beacon_expiry_policies
        WHERE (scope = 'Organization' AND organization_id = ${orgId})
           OR scope = 'System'
        ORDER BY scope = 'Organization' DESC
        LIMIT 1`,
  )) as unknown as { rows?: Array<{ default_expiry_days: number }> };
  const row = Array.isArray(rows)
    ? (rows[0] as { default_expiry_days: number } | undefined)
    : rows.rows?.[0];
  return row?.default_expiry_days ?? 90;
}

/**
 * Upsert a Beacon entry by slug. Globally unique natural key, so no
 * (organization_id, slug) composite: two orgs cannot collide on slug.
 */
export async function upsertEntryBySlug(
  input: EntryUpsertInput,
  userId: string,
  orgId: string,
): Promise<EntryUpsertResult> {
  if (!input.slug || input.slug.trim() === '') {
    throw new EntryUpsertError(
      'VALIDATION_ERROR',
      'slug is required and must be non-empty',
      400,
    );
  }
  if (!input.title || input.title.trim() === '') {
    throw new EntryUpsertError(
      'VALIDATION_ERROR',
      'title is required and must be non-empty',
      400,
    );
  }
  if (!input.body_markdown || input.body_markdown.trim() === '') {
    throw new EntryUpsertError(
      'VALIDATION_ERROR',
      'body_markdown is required and must be non-empty',
      400,
    );
  }

  const slug = input.slug.trim();

  // Pre-check so we can discriminate create vs. update before we decide
  // whether to emit a new beacon_versions row and bump `version`.
  const [existing] = await db
    .select()
    .from(beaconEntries)
    .where(eq(beaconEntries.slug, slug))
    .limit(1);

  if (!existing) {
    const expiryDays = await resolveDefaultExpiryDays(orgId);
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Race-safe insert: if a parallel writer grabbed the same slug between
    // our pre-check and this statement, ON CONFLICT (slug) gives us the
    // existing row. `xmax = 0` is true only for the freshly-inserted row.
    const inserted = await db
      .insert(beaconEntries)
      .values({
        slug,
        title: input.title,
        summary: input.summary ?? null,
        body_markdown: input.body_markdown,
        body_html: input.body_html ? sanitizeHtml(input.body_html) : null,
        version: 1,
        status: 'Draft',
        visibility: input.visibility ?? 'Project',
        created_by: userId,
        owned_by: userId,
        project_id: input.project_id ?? null,
        organization_id: orgId,
        expires_at: expiresAt,
        metadata: input.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: beaconEntries.slug,
        set: {
          // Deliberately narrow set: the conflict branch only happens when
          // a parallel writer raced us. Let the canonical update path
          // below handle the richer update semantics (version bump,
          // version snapshot). Here we just keep the row non-stale.
          updated_at: new Date(),
        },
      })
      .returning({
        entry: beaconEntries,
        created: sql<boolean>`(xmax = 0)`.as('created'),
      });

    const row = inserted[0];
    if (!row) {
      throw new EntryUpsertError('INTERNAL', 'Upsert returned no row', 500);
    }
    const entry = row.entry as typeof beaconEntries.$inferSelect;
    const created = row.created === true;

    if (created) {
      await db.insert(beaconVersions).values({
        beacon_id: entry.id,
        version: 1,
        title: input.title,
        summary: input.summary ?? null,
        body_markdown: input.body_markdown,
        changed_by: userId,
        change_note: 'Initial version (upsert)',
      });
    }

    return {
      data: entry,
      created,
      idempotency_key: `slug:${slug}`,
    };
  }

  // Update path: existing row with same slug. Bump version and write a
  // snapshot to mirror beacon_update.
  const newVersion = existing.version + 1;
  const [entry] = await db
    .update(beaconEntries)
    .set({
      title: input.title,
      summary: input.summary ?? null,
      body_markdown: input.body_markdown,
      body_html: input.body_html ? sanitizeHtml(input.body_html) : existing.body_html,
      version: newVersion,
      visibility: input.visibility ?? existing.visibility,
      metadata: input.metadata ?? existing.metadata,
      updated_at: new Date(),
    })
    .where(eq(beaconEntries.id, existing.id))
    .returning();

  if (!entry) {
    throw new EntryUpsertError('INTERNAL', 'Update returned no row', 500);
  }

  await db.insert(beaconVersions).values({
    beacon_id: entry.id,
    version: newVersion,
    title: input.title,
    summary: input.summary ?? null,
    body_markdown: input.body_markdown,
    changed_by: userId,
    change_note: input.change_note ?? 'upserted via beacon_upsert_by_slug',
  });

  return {
    data: entry,
    created: false,
    idempotency_key: `slug:${slug}`,
  };
}
