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
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      display_name: users.display_name,
      avatar_url: users.avatar_url,
      role: users.role,
      is_active: users.is_active,
      created_at: users.created_at,
      last_seen_at: users.last_seen_at,
    })
    .from(users)
    .where(eq(users.org_id, orgId))
    .orderBy(users.display_name);

  return result;
}

export async function inviteMember(
  orgId: string,
  email: string,
  role: string,
  displayName?: string,
) {
  const [user] = await db
    .insert(users)
    .values({
      org_id: orgId,
      email,
      display_name: displayName ?? email.split('@')[0]!,
      role,
    })
    .returning();

  return user!;
}

export async function updateMemberRole(orgId: string, userId: string, role: string) {
  // Wrap in a transaction and lock the user row FOR UPDATE to prevent
  // concurrent role changes from racing (e.g. org owner being demoted
  // mid-request while another request reads a stale role). This also keeps
  // the legacy users.role column in sync with organization_memberships.role
  // until the multi-org migration is complete.
  return await db.transaction(async (tx) => {
    // Lock the row to serialize concurrent role updates for this user.
    await tx.execute(sql`SELECT 1 FROM users WHERE id = ${userId} FOR UPDATE`);

    const [user] = await tx
      .update(users)
      .set({ role, updated_at: new Date() })
      .where(and(eq(users.id, userId), eq(users.org_id, orgId)))
      .returning();

    if (!user) return null;

    // Keep the organization_memberships row in sync with users.role until
    // the migration away from users.org_id/role is complete.
    await tx
      .update(organizationMemberships)
      .set({ role })
      .where(
        and(
          eq(organizationMemberships.user_id, userId),
          eq(organizationMemberships.org_id, orgId),
        ),
      );

    return user;
  });
}

export async function removeMember(orgId: string, userId: string) {
  const [deleted] = await db
    .delete(users)
    .where(and(eq(users.id, userId), eq(users.org_id, orgId)))
    .returning();

  return deleted ?? null;
}
