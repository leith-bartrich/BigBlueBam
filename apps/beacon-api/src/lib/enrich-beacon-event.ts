// ---------------------------------------------------------------------------
// Enrichment helper for Beacon Bolt event payloads.
//
// Phase B / Tier 1 of docs/bolt-id-mapping-strategy.md — every entity ID in
// an event payload should be accompanied by its canonical name(s), every
// primary entity should carry a `*.url`, and every event should include a
// fully-populated `actor` object and `org` context block.
//
// This module loads the extra joins needed (user, owner, org, tags) once and
// returns a plain object suitable for publishBoltEvent(...). It's intentionally
// defensive: if any lookup fails the caller still gets a usable payload with
// the core IDs, because Bolt event publication is fire-and-forget and must
// never break the originating mutation.
// ---------------------------------------------------------------------------

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, organizations } from '../db/schema/bbb-refs.js';
import { beaconTags } from '../db/schema/beacon-tags.js';
import { beaconUrl } from './urls.js';

export interface BeaconLike {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: string;
  visibility: string;
  version: number;
  created_by: string;
  owned_by: string;
  project_id: string | null;
  organization_id: string;
  expires_at: Date | string;
  last_verified_at: Date | string | null;
  last_verified_by: string | null;
  verification_count: number;
  created_at: Date | string;
  updated_at: Date | string;
  retired_at: Date | string | null;
  metadata?: unknown;
}

interface UserLike {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

interface OrgLike {
  id: string;
  name: string;
  slug: string;
}

async function loadUser(userId: string | null | undefined): Promise<UserLike | null> {
  if (!userId) return null;
  try {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        display_name: users.display_name,
        avatar_url: users.avatar_url,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

async function loadOrg(orgId: string): Promise<OrgLike | null> {
  try {
    const [row] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

async function loadTags(beaconId: string): Promise<string[]> {
  try {
    const rows = await db
      .select({ tag: beaconTags.tag })
      .from(beaconTags)
      .where(eq(beaconTags.beacon_id, beaconId));
    return rows.map((r) => r.tag);
  } catch {
    return [];
  }
}

function actorShape(user: UserLike | null, fallbackId: string) {
  if (!user) {
    return {
      id: fallbackId,
      name: null,
      email: null,
      avatar_url: null,
    };
  }
  return {
    id: user.id,
    name: user.display_name,
    email: user.email,
    avatar_url: user.avatar_url,
  };
}

function ownerShape(user: UserLike | null, fallbackId: string) {
  if (!user) {
    return {
      id: fallbackId,
      name: null,
      email: null,
    };
  }
  return {
    id: user.id,
    name: user.display_name,
    email: user.email,
  };
}

function orgShape(org: OrgLike | null, fallbackId: string) {
  if (!org) {
    return { id: fallbackId, name: null, slug: null };
  }
  return { id: org.id, name: org.name, slug: org.slug };
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d.toISOString();
}

/**
 * Build a fully-enriched payload for a Beacon event.
 *
 * The returned shape is:
 *
 *   {
 *     beacon: { id, slug, title, summary, status, visibility, url,
 *               tags[], owner_id, owner_name, owner_email,
 *               last_verified_at, expires_at, project_id, version },
 *     owner:  { id, name, email },
 *     actor:  { id, name, email, avatar_url },
 *     org:    { id, name, slug },
 *     ...extra
 *   }
 *
 * `extra` lets callers merge event-specific fields like `changes`, `challenge`,
 * or `verification` without re-loading the user/owner/org joins.
 */
export async function buildBeaconEventPayload(
  beacon: BeaconLike,
  actorId: string | null | undefined,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  // Parallel loads — actor, owner, org, tags
  const [actorUser, ownerUser, org, tags] = await Promise.all([
    loadUser(actorId ?? null),
    loadUser(beacon.owned_by),
    loadOrg(beacon.organization_id),
    loadTags(beacon.id),
  ]);

  return {
    beacon: {
      id: beacon.id,
      slug: beacon.slug,
      title: beacon.title,
      summary: beacon.summary,
      status: beacon.status,
      visibility: beacon.visibility,
      version: beacon.version,
      url: beaconUrl(beacon.slug ?? beacon.id),
      tags,
      owner_id: beacon.owned_by,
      owner_name: ownerUser?.display_name ?? null,
      owner_email: ownerUser?.email ?? null,
      created_by: beacon.created_by,
      project_id: beacon.project_id,
      expires_at: toIso(beacon.expires_at),
      last_verified_at: toIso(beacon.last_verified_at),
      last_verified_by: beacon.last_verified_by,
      verification_count: beacon.verification_count,
      retired_at: toIso(beacon.retired_at),
      created_at: toIso(beacon.created_at),
      updated_at: toIso(beacon.updated_at),
      // TODO: beacon.category_name — no category column exists on
      // beacon_entries yet; tags carry the taxonomy. Add when schema lands.
    },
    owner: ownerShape(ownerUser, beacon.owned_by),
    actor: actorShape(actorUser, actorId ?? ''),
    org: orgShape(org, beacon.organization_id),
    ...extra,
  };
}
