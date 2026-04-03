import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { organizations } from '../db/schema/organizations.js';
import { users } from '../db/schema/users.js';

export async function getOrganization(orgId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  return org ?? null;
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
  const [user] = await db
    .update(users)
    .set({ role, updated_at: new Date() })
    .where(and(eq(users.id, userId), eq(users.org_id, orgId)))
    .returning();

  return user ?? null;
}

export async function removeMember(orgId: string, userId: string) {
  const [deleted] = await db
    .delete(users)
    .where(and(eq(users.id, userId), eq(users.org_id, orgId)))
    .returning();

  return deleted ?? null;
}
