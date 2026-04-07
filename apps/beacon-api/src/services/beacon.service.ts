import { eq, and, or, sql, asc, gt, inArray, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  beaconEntries,
  beaconVersions,
  beaconExpiryPolicies,
} from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

/**
 * Convert a title to a URL-friendly slug.
 * Rules: lowercase, replace non-alphanumeric with hyphens, collapse runs of
 * hyphens, trim leading/trailing hyphens, truncate to 200 chars.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

/**
 * Generate a unique slug for a beacon entry.  Appends -2, -3, etc. if the
 * base slug already exists.
 */
async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  if (!base) return `beacon-${Date.now()}`;

  const existing = await db
    .select({ slug: beaconEntries.slug })
    .from(beaconEntries)
    .where(or(eq(beaconEntries.slug, base), ilike(beaconEntries.slug, `${base}-%`)));

  const taken = new Set(existing.map((r) => r.slug));
  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ---------------------------------------------------------------------------
// Expiry policy resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the effective default_expiry_days for a beacon by walking the
 * policy hierarchy: Project → Organization → System.
 * Falls back to 90 days if no policy is found.
 */
async function resolveDefaultExpiryDays(
  orgId: string,
  projectId: string | null,
): Promise<number> {
  // Try project-level first
  if (projectId) {
    const [projectPolicy] = await db
      .select({ default_expiry_days: beaconExpiryPolicies.default_expiry_days })
      .from(beaconExpiryPolicies)
      .where(
        and(
          eq(beaconExpiryPolicies.scope, 'Project'),
          eq(beaconExpiryPolicies.project_id, projectId),
        ),
      )
      .limit(1);
    if (projectPolicy) return projectPolicy.default_expiry_days;
  }

  // Try org-level
  const [orgPolicy] = await db
    .select({ default_expiry_days: beaconExpiryPolicies.default_expiry_days })
    .from(beaconExpiryPolicies)
    .where(
      and(
        eq(beaconExpiryPolicies.scope, 'Organization'),
        eq(beaconExpiryPolicies.organization_id, orgId),
      ),
    )
    .limit(1);
  if (orgPolicy) return orgPolicy.default_expiry_days;

  // Try system-level
  const [sysPolicy] = await db
    .select({ default_expiry_days: beaconExpiryPolicies.default_expiry_days })
    .from(beaconExpiryPolicies)
    .where(eq(beaconExpiryPolicies.scope, 'System'))
    .limit(1);
  if (sysPolicy) return sysPolicy.default_expiry_days;

  return 90; // hard-coded fallback
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class BeaconError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'BeaconError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export interface CreateBeaconInput {
  title: string;
  summary?: string | null;
  body_markdown: string;
  body_html?: string | null;
  visibility?: 'Public' | 'Organization' | 'Project' | 'Private';
  project_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createBeacon(
  data: CreateBeaconInput,
  userId: string,
  orgId: string,
) {
  const slug = await uniqueSlug(data.title);
  const expiryDays = await resolveDefaultExpiryDays(orgId, data.project_id ?? null);
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const [beacon] = await db
    .insert(beaconEntries)
    .values({
      slug,
      title: data.title,
      summary: data.summary ?? null,
      body_markdown: data.body_markdown,
      body_html: data.body_html ?? null,
      version: 1,
      status: 'Draft',
      visibility: data.visibility ?? 'Project',
      created_by: userId,
      owned_by: userId,
      project_id: data.project_id ?? null,
      organization_id: orgId,
      expires_at: expiresAt,
      metadata: data.metadata ?? {},
    })
    .returning();

  // Insert first version row
  await db.insert(beaconVersions).values({
    beacon_id: beacon!.id,
    version: 1,
    title: data.title,
    summary: data.summary ?? null,
    body_markdown: data.body_markdown,
    changed_by: userId,
    change_note: 'Initial version',
  });

  return beacon!;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getBeacon(idOrSlug: string, userId: string) {
  const isUuid = UUID_REGEX.test(idOrSlug);

  const condition = isUuid
    ? eq(beaconEntries.id, idOrSlug)
    : eq(beaconEntries.slug, idOrSlug);

  const [beacon] = await db
    .select()
    .from(beaconEntries)
    .where(condition)
    .limit(1);

  if (!beacon) return null;

  // Visibility check: Private beacons only visible to owner/creator
  if (beacon.visibility === 'Private') {
    if (beacon.owned_by !== userId && beacon.created_by !== userId) {
      return null;
    }
  }

  return beacon;
}

export interface ListBeaconsFilters {
  orgId: string;
  projectIds?: string[];
  status?: string;
  tags?: string[];
  visibilityMax?: string;
  expiresAfter?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export async function listBeacons(filters: ListBeaconsFilters) {
  const conditions = [eq(beaconEntries.organization_id, filters.orgId)];

  if (filters.projectIds && filters.projectIds.length > 0) {
    conditions.push(inArray(beaconEntries.project_id, filters.projectIds));
  }

  if (filters.status) {
    conditions.push(eq(beaconEntries.status, filters.status as any));
  }

  if (filters.expiresAfter) {
    conditions.push(gt(beaconEntries.expires_at, new Date(filters.expiresAfter)));
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(beaconEntries.title, `%${filters.search}%`),
        ilike(beaconEntries.summary, `%${filters.search}%`),
      )!,
    );
  }

  const limit = Math.min(filters.limit ?? 50, 100);

  if (filters.cursor) {
    conditions.push(gt(beaconEntries.created_at, new Date(filters.cursor)));
  }

  const result = await db
    .select()
    .from(beaconEntries)
    .where(and(...conditions))
    .orderBy(asc(beaconEntries.created_at))
    .limit(limit + 1);

  const hasMore = result.length > limit;
  const data = hasMore ? result.slice(0, limit) : result;
  const nextCursor =
    hasMore && data.length > 0
      ? data[data.length - 1]!.created_at.toISOString()
      : null;

  return {
    data,
    meta: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

export interface UpdateBeaconInput {
  title?: string;
  summary?: string | null;
  body_markdown?: string;
  body_html?: string | null;
  visibility?: 'Public' | 'Organization' | 'Project' | 'Private';
  metadata?: Record<string, unknown>;
  change_note?: string;
}

export async function updateBeacon(
  id: string,
  data: UpdateBeaconInput,
  userId: string,
) {
  const existing = await getBeaconById(id);
  if (!existing) throw new BeaconError('NOT_FOUND', 'Beacon not found', 404);

  const newVersion = existing.version + 1;

  const updateValues: Record<string, unknown> = {
    version: newVersion,
    updated_at: new Date(),
  };
  if (data.title !== undefined) updateValues.title = data.title;
  if (data.summary !== undefined) updateValues.summary = data.summary;
  if (data.body_markdown !== undefined) updateValues.body_markdown = data.body_markdown;
  if (data.body_html !== undefined) updateValues.body_html = data.body_html;
  if (data.visibility !== undefined) updateValues.visibility = data.visibility;
  if (data.metadata !== undefined) updateValues.metadata = data.metadata;

  const [beacon] = await db
    .update(beaconEntries)
    .set(updateValues)
    .where(eq(beaconEntries.id, id))
    .returning();

  // Insert version snapshot
  await db.insert(beaconVersions).values({
    beacon_id: id,
    version: newVersion,
    title: data.title ?? existing.title,
    summary: data.summary !== undefined ? data.summary : existing.summary,
    body_markdown: data.body_markdown ?? existing.body_markdown,
    changed_by: userId,
    change_note: data.change_note ?? null,
  });

  return beacon!;
}

export async function retireBeacon(id: string, _userId: string) {
  const existing = await getBeaconById(id);
  if (!existing) throw new BeaconError('NOT_FOUND', 'Beacon not found', 404);

  const [beacon] = await db
    .update(beaconEntries)
    .set({
      status: 'Retired',
      retired_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(beaconEntries.id, id))
    .returning();

  return beacon!;
}

export async function publishBeacon(id: string, _userId: string) {
  const existing = await getBeaconById(id);
  if (!existing) throw new BeaconError('NOT_FOUND', 'Beacon not found', 404);

  if (existing.status !== 'Draft') {
    throw new BeaconError(
      'INVALID_TRANSITION',
      `Cannot publish a beacon with status '${existing.status}'; must be Draft`,
    );
  }

  // Compute expires_at from policy on publish
  const expiryDays = await resolveDefaultExpiryDays(
    existing.organization_id,
    existing.project_id,
  );
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const [beacon] = await db
    .update(beaconEntries)
    .set({
      status: 'Active',
      expires_at: expiresAt,
      updated_at: new Date(),
    })
    .where(eq(beaconEntries.id, id))
    .returning();

  return beacon!;
}

export async function restoreBeacon(id: string, _userId: string) {
  const existing = await getBeaconById(id);
  if (!existing) throw new BeaconError('NOT_FOUND', 'Beacon not found', 404);

  if (existing.status !== 'Archived') {
    throw new BeaconError(
      'INVALID_TRANSITION',
      `Cannot restore a beacon with status '${existing.status}'; must be Archived`,
    );
  }

  const expiryDays = await resolveDefaultExpiryDays(
    existing.organization_id,
    existing.project_id,
  );
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const [beacon] = await db
    .update(beaconEntries)
    .set({
      status: 'Active',
      expires_at: expiresAt,
      last_verified_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(beaconEntries.id, id))
    .returning();

  return beacon!;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function getBeaconById(id: string) {
  const [beacon] = await db
    .select()
    .from(beaconEntries)
    .where(eq(beaconEntries.id, id))
    .limit(1);
  return beacon ?? null;
}
