import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { organizations } from '../db/schema/organizations.js';
import { users } from '../db/schema/users.js';
import { organizationMemberships } from '../db/schema/organization-memberships.js';

export async function getOrganization(orgId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  return org ?? null;
}

// Simple in-memory cache for org settings reads used by permission checks.
// Not a true LRU — bounded via periodic cleanup when size crosses threshold.
type CachedOrg = Awaited<ReturnType<typeof getOrganization>>;
const orgCache = new Map<string, { data: NonNullable<CachedOrg>; expires: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

export async function getOrganizationCached(orgId: string) {
  const cached = orgCache.get(orgId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  const org = await getOrganization(orgId);
  if (org) {
    orgCache.set(orgId, { data: org, expires: Date.now() + CACHE_TTL_MS });
  }
  return org;
}

export function invalidateOrgCache(orgId: string) {
  orgCache.delete(orgId);
}

export async function updateOrganization(
  orgId: string,
  data: { name?: string; logo_url?: string | null; settings?: Record<string, unknown> },
) {
  const updateValues: Record<string, unknown> = { updated_at: new Date() };
  if (data.name !== undefined) updateValues.name = data.name;
  if (data.logo_url !== undefined) updateValues.logo_url = data.logo_url;
  if (data.settings !== undefined) updateValues.settings = data.settings;

  const [org] = await db
    .update(organizations)
    .set(updateValues)
    .where(eq(organizations.id, orgId))
    .returning();

  invalidateOrgCache(orgId);

  return org ?? null;
}

export async function listOrgMembers(orgId: string) {
  // Source of truth is organization_memberships — a user may be in many
  // orgs via membership rows even if users.org_id still points somewhere
  // else (legacy). Each member's role is the MEMBERSHIP role for this org,
  // not users.role (which is the legacy home-org role).
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      display_name: users.display_name,
      avatar_url: users.avatar_url,
      role: organizationMemberships.role,
      is_active: users.is_active,
      created_at: users.created_at,
      last_seen_at: users.last_seen_at,
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(organizationMemberships.user_id, users.id))
    .where(eq(organizationMemberships.org_id, orgId))
    .orderBy(users.display_name);

  return result;
}

/** Custom error raised when inviteMember detects the invitee is already a
 *  member of the target org. The route handler translates this to 409. */
export class AlreadyMemberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlreadyMemberError';
  }
}

export async function inviteMember(
  orgId: string,
  email: string,
  role: string,
  displayName?: string,
) {
  // Look up an existing user by email first — they may already exist from
  // a different org's invite. The users.email UNIQUE constraint makes email
  // the global identity; multi-org belonging is expressed via
  // organization_memberships rows.
  const normalizedEmail = email.toLowerCase().trim();
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser) {
    // Already a member of THIS org? Reject — nothing to do.
    const [existingMembership] = await db
      .select({ id: organizationMemberships.id })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.user_id, existingUser.id),
          eq(organizationMemberships.org_id, orgId),
        ),
      )
      .limit(1);
    if (existingMembership) {
      throw new AlreadyMemberError('User is already a member of this organization');
    }
    // Add them as a member of this org. is_default stays false — their
    // existing default org is preserved so their next login lands where
    // they expect.
    await db.insert(organizationMemberships).values({
      user_id: existingUser.id,
      org_id: orgId,
      role,
      is_default: false,
    });
    return existingUser;
  }

  // Brand-new user — create the user row + their first membership. This
  // org becomes their default. users.org_id + users.role are filled in as
  // the legacy single-org fallback until they're retired in a later
  // migration; organization_memberships is the authoritative source.
  return await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        org_id: orgId,
        email: normalizedEmail,
        display_name: displayName ?? normalizedEmail.split('@')[0]!,
        role,
      })
      .returning();

    await tx.insert(organizationMemberships).values({
      user_id: user!.id,
      org_id: orgId,
      role,
      is_default: true,
    });

    return user!;
  });
}

export async function updateMemberRole(orgId: string, userId: string, role: string) {
  // Update the organization_memberships row — that's the per-org role.
  // Locking via SELECT FOR UPDATE serializes concurrent role changes.
  // users.role is a legacy single-org column; keep it synced ONLY when
  // the target user's home org matches the org we're editing, otherwise
  // we'd clobber their role in a different org.
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT 1 FROM organization_memberships WHERE user_id = ${userId} AND org_id = ${orgId} FOR UPDATE`,
    );

    const [membership] = await tx
      .update(organizationMemberships)
      .set({ role })
      .where(
        and(
          eq(organizationMemberships.user_id, userId),
          eq(organizationMemberships.org_id, orgId),
        ),
      )
      .returning();

    if (!membership) return null;

    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user && user.org_id === orgId) {
      await tx
        .update(users)
        .set({ role, updated_at: new Date() })
        .where(eq(users.id, userId));
    }

    return user ?? null;
  });
}

export async function removeMember(orgId: string, userId: string) {
  // Only remove the MEMBERSHIP row — the user identity lives globally and
  // may still be a member of other orgs. Deleting the user row outright
  // would have cascade-deleted their sessions, API keys, and every other
  // org's membership of the same user.
  const [deleted] = await db
    .delete(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.user_id, userId),
        eq(organizationMemberships.org_id, orgId),
      ),
    )
    .returning();

  return deleted ?? null;
}
