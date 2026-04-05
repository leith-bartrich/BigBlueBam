import { eq, and, sql, inArray } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { organizations } from '../db/schema/organizations.js';
import { users } from '../db/schema/users.js';
import { organizationMemberships } from '../db/schema/organization-memberships.js';
import { sessions } from '../db/schema/sessions.js';
import { projects } from '../db/schema/projects.js';
import { projectMemberships } from '../db/schema/project-memberships.js';

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

/** Counts members of an org who are also currently active (is_active=true). */
export async function getOrgMemberCounts(orgId: string): Promise<{
  active_owner_count: number;
  member_count: number;
}> {
  const [row] = await db
    .select({
      active_owner_count: sql<number>`COUNT(*) FILTER (WHERE ${organizationMemberships.role} = 'owner' AND ${users.is_active} = true)::int`,
      member_count: sql<number>`COUNT(*) FILTER (WHERE ${users.is_active} = true)::int`,
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(organizationMemberships.user_id, users.id))
    .where(eq(organizationMemberships.org_id, orgId));

  return {
    active_owner_count: Number(row?.active_owner_count ?? 0),
    member_count: Number(row?.member_count ?? 0),
  };
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
): Promise<{ user: typeof users.$inferSelect; was_existing: boolean }> {
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
    return { user: existingUser, was_existing: true };
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

    return { user: user!, was_existing: false };
  });
}

const ROLE_HIERARCHY = ['guest', 'viewer', 'member', 'admin', 'owner'] as const;

/** Raised when the caller's rank isn't strictly above the target's rank. */
export class InsufficientRankError extends Error {
  constructor(message = 'You cannot act on a user at or above your own role') {
    super(message);
    this.name = 'InsufficientRankError';
  }
}

/**
 * Rank check: caller's level must be strictly ABOVE target's level, AND
 * caller must be at least admin. SuperUsers bypass the check entirely.
 */
export function checkRankAbove(
  callerRole: string,
  targetRole: string,
  callerIsSuperuser: boolean,
): { allowed: boolean; reason?: string } {
  if (callerIsSuperuser) return { allowed: true };

  const callerLevel = ROLE_HIERARCHY.indexOf(callerRole as (typeof ROLE_HIERARCHY)[number]);
  const targetLevel = ROLE_HIERARCHY.indexOf(targetRole as (typeof ROLE_HIERARCHY)[number]);

  if (callerLevel < 0 || targetLevel < 0) {
    return { allowed: false, reason: 'Unknown role' };
  }
  if (callerLevel < ROLE_HIERARCHY.indexOf('admin')) {
    return { allowed: false, reason: 'Caller must be admin or owner' };
  }
  if (callerLevel <= targetLevel) {
    return {
      allowed: false,
      reason: 'You cannot act on a user at or above your own role',
    };
  }
  return { allowed: true };
}

/** Fetches a user's membership role for a given org, or null if not a member. */
async function getMembershipRole(orgId: string, userId: string): Promise<string | null> {
  const [m] = await db
    .select({ role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.user_id, userId),
        eq(organizationMemberships.org_id, orgId),
      ),
    )
    .limit(1);
  return m?.role ?? null;
}

/** Validates that every project in `projectIds` belongs to `orgId`. Returns
 *  the list of project IDs that do NOT belong (empty = all valid). */
async function findCrossOrgProjects(orgId: string, projectIds: string[]): Promise<string[]> {
  if (projectIds.length === 0) return [];
  const rows = await db
    .select({ id: projects.id, org_id: projects.org_id })
    .from(projects)
    .where(inArray(projects.id, projectIds));
  const byId = new Map(rows.map((r) => [r.id, r.org_id]));
  const bad: string[] = [];
  for (const pid of projectIds) {
    const row = byId.get(pid);
    if (!row || row !== orgId) bad.push(pid);
  }
  return bad;
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: string,
  opts: { callerRole: string; callerIsSuperuser: boolean },
) {
  // Update the organization_memberships row — that's the per-org role.
  // Locking via SELECT FOR UPDATE serializes concurrent role changes.
  // users.role is a legacy single-org column; keep it synced ONLY when
  // the target user's home org matches the org we're editing, otherwise
  // we'd clobber their role in a different org.
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT 1 FROM organization_memberships WHERE user_id = ${userId} AND org_id = ${orgId} FOR UPDATE`,
    );

    // Load target's current membership role for the rank check.
    const [existing] = await tx
      .select({ role: organizationMemberships.role })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.user_id, userId),
          eq(organizationMemberships.org_id, orgId),
        ),
      )
      .limit(1);

    if (!existing) return null;

    const rank = checkRankAbove(opts.callerRole, existing.role, opts.callerIsSuperuser);
    if (!rank.allowed) {
      throw new InsufficientRankError(rank.reason);
    }

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

/** Raised when the caller tries to reset a password for a user whose role
 *  is above their own, or when they try to reset their own password through
 *  this admin endpoint. */
export class PasswordResetForbiddenError extends Error {
  constructor(
    message: string,
    public readonly code: 'CANNOT_RESET_SELF' | 'INSUFFICIENT_PERMISSIONS' | 'TARGET_NOT_FOUND',
  ) {
    super(message);
    this.name = 'PasswordResetForbiddenError';
  }
}

// 16 chars from an alphabet that excludes easily-confused glyphs (0/O, 1/l/I,
// etc.). ~95 bits of entropy — more than enough for a freshly-minted admin
// reset that the user is expected to change on next login.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generateStrongPassword(length = 16): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[bytes[i]! % PASSWORD_ALPHABET.length];
  }
  return out;
}

/**
 * Resets the password of another user. The caller must be either:
 *  - A SuperUser (may reset anyone, anywhere), or
 *  - An owner/admin of `orgId` whose role rank is STRICTLY above the
 *    target's membership role in that org (peers cannot reset each other).
 *
 * Caller may not reset their own password here — they should go through
 * the profile/settings flow instead.
 *
 * On success, returns the target user + the raw password (visible exactly
 * once to the admin for sharing). All of the target's active sessions are
 * invalidated so any stolen cookie becomes unusable after the reset.
 */
export async function resetMemberPassword(opts: {
  orgId: string;
  targetUserId: string;
  callerUserId: string;
  callerIsSuperuser: boolean;
  callerRole: string;
  newPassword: string | null;
}): Promise<{ user: typeof users.$inferSelect; password: string }> {
  const { orgId, targetUserId, callerUserId, callerIsSuperuser, callerRole, newPassword } = opts;

  if (targetUserId === callerUserId) {
    throw new PasswordResetForbiddenError(
      'Use profile settings to change your own password',
      'CANNOT_RESET_SELF',
    );
  }

  // Fetch target user. SuperUsers may reset anyone (regardless of membership
  // in the current org); everyone else must target a member of the caller's
  // active org, and we read that membership's role for the rank comparison.
  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!targetUser) {
    throw new PasswordResetForbiddenError('Target user not found', 'TARGET_NOT_FOUND');
  }

  if (!callerIsSuperuser) {
    const targetRole = await getMembershipRole(orgId, targetUserId);

    if (!targetRole) {
      // Don't leak existence — target is not a member of YOUR org.
      throw new PasswordResetForbiddenError('Target user not found', 'TARGET_NOT_FOUND');
    }

    const rank = checkRankAbove(callerRole, targetRole, callerIsSuperuser);
    if (!rank.allowed) {
      throw new PasswordResetForbiddenError(
        rank.reason ?? 'You cannot reset the password of a user at or above your own role',
        'INSUFFICIENT_PERMISSIONS',
      );
    }
  }

  const rawPassword = newPassword ?? generateStrongPassword();
  const passwordHash = await argon2.hash(rawPassword);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ password_hash: passwordHash, updated_at: new Date() })
      .where(eq(users.id, targetUserId));
    // Invalidate every active session for the target so a leaked cookie
    // can't outlive the reset.
    await tx.delete(sessions).where(eq(sessions.user_id, targetUserId));
  });

  return { user: targetUser, password: rawPassword };
}

export async function removeMember(
  orgId: string,
  userId: string,
  opts: { callerRole: string; callerIsSuperuser: boolean },
) {
  const targetRole = await getMembershipRole(orgId, userId);
  if (!targetRole) return null;

  const rank = checkRankAbove(opts.callerRole, targetRole, opts.callerIsSuperuser);
  if (!rank.allowed) {
    throw new InsufficientRankError(rank.reason);
  }

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

/** Detailed view of a single member in the current org, including the
 *  user's project memberships scoped to THIS org. Returns null if the
 *  target is not a member of this org. */
export async function getOrgMemberDetail(orgId: string, userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      display_name: users.display_name,
      avatar_url: users.avatar_url,
      timezone: users.timezone,
      is_active: users.is_active,
      disabled_at: users.disabled_at,
      disabled_by: users.disabled_by,
      created_at: users.created_at,
      last_seen_at: users.last_seen_at,
      role: organizationMemberships.role,
      joined_at: organizationMemberships.joined_at,
      is_default_org: organizationMemberships.is_default,
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(organizationMemberships.user_id, users.id))
    .where(
      and(
        eq(organizationMemberships.user_id, userId),
        eq(organizationMemberships.org_id, orgId),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Load disabled_by info (only the small identity subset) if set.
  let disabledBy: { id: string; email: string; display_name: string } | null = null;
  if (row.disabled_by) {
    const [dbRow] = await db
      .select({
        id: users.id,
        email: users.email,
        display_name: users.display_name,
      })
      .from(users)
      .where(eq(users.id, row.disabled_by))
      .limit(1);
    disabledBy = dbRow ?? null;
  }

  // Project memberships in THIS org.
  const userProjects = await db
    .select({
      project_id: projects.id,
      name: projects.name,
      role: projectMemberships.role,
      joined_at: projectMemberships.joined_at,
    })
    .from(projectMemberships)
    .innerJoin(projects, eq(projectMemberships.project_id, projects.id))
    .where(
      and(
        eq(projectMemberships.user_id, userId),
        eq(projects.org_id, orgId),
      ),
    )
    .orderBy(projects.name);

  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    timezone: row.timezone,
    role: row.role,
    is_active: row.is_active,
    disabled_at: row.disabled_at,
    disabled_by: disabledBy,
    joined_at: row.joined_at,
    is_default_org: row.is_default_org,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    projects: userProjects,
  };
}

/** Updates display_name / timezone on the target user row. Rank check is
 *  expected to be enforced by the caller. Returns the updated user or null
 *  if target isn't a member of this org. */
export async function updateMemberProfile(
  orgId: string,
  userId: string,
  data: { display_name?: string; timezone?: string },
  opts: { callerRole: string; callerIsSuperuser: boolean },
) {
  const targetRole = await getMembershipRole(orgId, userId);
  if (!targetRole) return null;

  const rank = checkRankAbove(opts.callerRole, targetRole, opts.callerIsSuperuser);
  if (!rank.allowed) {
    throw new InsufficientRankError(rank.reason);
  }

  const updateValues: Record<string, unknown> = { updated_at: new Date() };
  if (data.display_name !== undefined) updateValues.display_name = data.display_name;
  if (data.timezone !== undefined) updateValues.timezone = data.timezone;

  const [updated] = await db
    .update(users)
    .set(updateValues)
    .where(eq(users.id, userId))
    .returning();

  return updated ?? null;
}

/** Toggle is_active for the target user. When disabling, all of the
 *  target's sessions are invalidated. Returns status + whether the org
 *  now has zero active owners (for a UI banner). */
export async function setMemberActive(
  orgId: string,
  userId: string,
  isActive: boolean,
  opts: { callerUserId: string; callerRole: string; callerIsSuperuser: boolean },
): Promise<{
  user_id: string;
  is_active: boolean;
  disabled_at: Date | null;
  last_owner_remaining: boolean;
} | null> {
  if (userId === opts.callerUserId) {
    throw new InsufficientRankError('You cannot change your own active status');
  }

  const targetRole = await getMembershipRole(orgId, userId);
  if (!targetRole) return null;

  const rank = checkRankAbove(opts.callerRole, targetRole, opts.callerIsSuperuser);
  if (!rank.allowed) {
    throw new InsufficientRankError(rank.reason);
  }

  const result = await db.transaction(async (tx) => {
    if (isActive) {
      const [u] = await tx
        .update(users)
        .set({ is_active: true, disabled_at: null, disabled_by: null, updated_at: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return u ?? null;
    }

    const [u] = await tx
      .update(users)
      .set({
        is_active: false,
        disabled_at: new Date(),
        disabled_by: opts.callerUserId,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    // Kill all sessions for the disabled user.
    await tx.delete(sessions).where(eq(sessions.user_id, userId));
    return u ?? null;
  });

  if (!result) return null;

  const counts = await getOrgMemberCounts(orgId);

  return {
    user_id: result.id,
    is_active: result.is_active,
    disabled_at: result.disabled_at,
    last_owner_remaining: counts.active_owner_count === 0,
  };
}

/** Error raised by transferOwnership for bad preconditions. */
export class TransferOwnershipError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'CALLER_NOT_OWNER'
      | 'TARGET_NOT_MEMBER'
      | 'CANNOT_TRANSFER_TO_SELF',
  ) {
    super(message);
    this.name = 'TransferOwnershipError';
  }
}

/** Atomically transfer ownership from caller to target within an org.
 *  Caller must currently be an owner of the org (or a SuperUser).
 *  Target must be a current member of the org. */
export async function transferOwnership(opts: {
  orgId: string;
  callerUserId: string;
  targetUserId: string;
  callerIsSuperuser: boolean;
}): Promise<{ previous_owner_id: string; new_owner_id: string; org_id: string }> {
  const { orgId, callerUserId, targetUserId, callerIsSuperuser } = opts;

  if (callerUserId === targetUserId) {
    throw new TransferOwnershipError(
      'You cannot transfer ownership to yourself',
      'CANNOT_TRANSFER_TO_SELF',
    );
  }

  return await db.transaction(async (tx) => {
    // Lock both membership rows to serialize concurrent transfers.
    await tx.execute(
      sql`SELECT 1 FROM organization_memberships WHERE org_id = ${orgId} AND user_id IN (${callerUserId}, ${targetUserId}) FOR UPDATE`,
    );

    const [callerMembership] = await tx
      .select({ role: organizationMemberships.role })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.user_id, callerUserId),
          eq(organizationMemberships.org_id, orgId),
        ),
      )
      .limit(1);

    if (!callerIsSuperuser && callerMembership?.role !== 'owner') {
      throw new TransferOwnershipError(
        'Only an owner may transfer ownership',
        'CALLER_NOT_OWNER',
      );
    }

    const [targetMembership] = await tx
      .select({ role: organizationMemberships.role })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.user_id, targetUserId),
          eq(organizationMemberships.org_id, orgId),
        ),
      )
      .limit(1);

    if (!targetMembership) {
      throw new TransferOwnershipError(
        'Target user is not a member of this organization',
        'TARGET_NOT_MEMBER',
      );
    }

    // Demote caller to admin (only if caller had a membership — SuperUsers
    // may not be members of this org).
    if (callerMembership) {
      await tx
        .update(organizationMemberships)
        .set({ role: 'admin' })
        .where(
          and(
            eq(organizationMemberships.user_id, callerUserId),
            eq(organizationMemberships.org_id, orgId),
          ),
        );
    }

    // Promote target to owner.
    await tx
      .update(organizationMemberships)
      .set({ role: 'owner' })
      .where(
        and(
          eq(organizationMemberships.user_id, targetUserId),
          eq(organizationMemberships.org_id, orgId),
        ),
      );

    // Mirror to users.role when users.org_id matches — legacy single-org sync.
    const legacy = await tx
      .select({ id: users.id, org_id: users.org_id })
      .from(users)
      .where(inArray(users.id, [callerUserId, targetUserId]));
    for (const u of legacy) {
      if (u.org_id !== orgId) continue;
      const newRole = u.id === targetUserId ? 'owner' : 'admin';
      await tx
        .update(users)
        .set({ role: newRole, updated_at: new Date() })
        .where(eq(users.id, u.id));
    }

    return {
      previous_owner_id: callerUserId,
      new_owner_id: targetUserId,
      org_id: orgId,
    };
  });
}

/** Lists a user's project memberships within a single org. Returns null if
 *  the user isn't a member of this org. */
export async function getMemberProjectsInOrg(orgId: string, userId: string) {
  const membershipRole = await getMembershipRole(orgId, userId);
  if (membershipRole === null) return null;

  const rows = await db
    .select({
      project_id: projects.id,
      project_name: projects.name,
      project_slug: projects.slug,
      role: projectMemberships.role,
      joined_at: projectMemberships.joined_at,
      is_archived: projects.is_archived,
    })
    .from(projectMemberships)
    .innerJoin(projects, eq(projectMemberships.project_id, projects.id))
    .where(
      and(
        eq(projectMemberships.user_id, userId),
        eq(projects.org_id, orgId),
      ),
    )
    .orderBy(projects.name);

  return rows;
}

/** Error raised when a project-membership operation finds a project in a
 *  different org than the caller's current org. */
export class CrossOrgProjectError extends Error {
  constructor(public readonly projectIds: string[]) {
    super(`Project(s) not in current org: ${projectIds.join(', ')}`);
    this.name = 'CrossOrgProjectError';
  }
}

/** Bulk-add a user to multiple projects in the caller's current org.
 *  Existing memberships are skipped (no role change). Returns lists of
 *  added vs. skipped project IDs. */
export async function addMemberToProjects(
  orgId: string,
  userId: string,
  assignments: { project_id: string; role: 'admin' | 'member' | 'viewer' }[],
  opts: { callerRole: string; callerIsSuperuser: boolean },
): Promise<{ added: string[]; skipped: string[] }> {
  const targetRole = await getMembershipRole(orgId, userId);
  if (targetRole === null) {
    // Signal "target not a member" via a sentinel — route returns 404.
    throw new InsufficientRankError('Target user is not a member of this organization');
  }

  const rank = checkRankAbove(opts.callerRole, targetRole, opts.callerIsSuperuser);
  if (!rank.allowed) {
    throw new InsufficientRankError(rank.reason);
  }

  const projectIds = assignments.map((a) => a.project_id);
  const bad = await findCrossOrgProjects(orgId, projectIds);
  if (bad.length > 0) throw new CrossOrgProjectError(bad);

  // Find which memberships already exist so we can classify added vs skipped.
  const existing = await db
    .select({ project_id: projectMemberships.project_id })
    .from(projectMemberships)
    .where(
      and(
        eq(projectMemberships.user_id, userId),
        inArray(projectMemberships.project_id, projectIds),
      ),
    );
  const existingSet = new Set(existing.map((r) => r.project_id));

  const toInsert = assignments.filter((a) => !existingSet.has(a.project_id));
  if (toInsert.length > 0) {
    // ON CONFLICT DO NOTHING guards against concurrent inserts racing.
    await db
      .insert(projectMemberships)
      .values(
        toInsert.map((a) => ({
          project_id: a.project_id,
          user_id: userId,
          role: a.role,
        })),
      )
      .onConflictDoNothing({
        target: [projectMemberships.project_id, projectMemberships.user_id],
      });
  }

  return {
    added: toInsert.map((a) => a.project_id),
    skipped: assignments.filter((a) => existingSet.has(a.project_id)).map((a) => a.project_id),
  };
}

/** Update a user's role on a single project in the caller's current org. */
export async function updateMemberProjectRole(
  orgId: string,
  userId: string,
  projectId: string,
  role: 'admin' | 'member' | 'viewer',
  opts: { callerRole: string; callerIsSuperuser: boolean },
): Promise<{ project_id: string; user_id: string; role: string } | null> {
  const targetRole = await getMembershipRole(orgId, userId);
  if (targetRole === null) return null;

  const rank = checkRankAbove(opts.callerRole, targetRole, opts.callerIsSuperuser);
  if (!rank.allowed) {
    throw new InsufficientRankError(rank.reason);
  }

  const bad = await findCrossOrgProjects(orgId, [projectId]);
  if (bad.length > 0) throw new CrossOrgProjectError(bad);

  const [updated] = await db
    .update(projectMemberships)
    .set({ role })
    .where(
      and(
        eq(projectMemberships.user_id, userId),
        eq(projectMemberships.project_id, projectId),
      ),
    )
    .returning({
      project_id: projectMemberships.project_id,
      user_id: projectMemberships.user_id,
      role: projectMemberships.role,
    });

  return updated ?? null;
}

/** Remove a user from a single project in the caller's current org. */
export async function removeMemberFromProject(
  orgId: string,
  userId: string,
  projectId: string,
  opts: { callerRole: string; callerIsSuperuser: boolean },
): Promise<boolean | null> {
  const targetRole = await getMembershipRole(orgId, userId);
  if (targetRole === null) return null;

  const rank = checkRankAbove(opts.callerRole, targetRole, opts.callerIsSuperuser);
  if (!rank.allowed) {
    throw new InsufficientRankError(rank.reason);
  }

  const bad = await findCrossOrgProjects(orgId, [projectId]);
  if (bad.length > 0) throw new CrossOrgProjectError(bad);

  const [deleted] = await db
    .delete(projectMemberships)
    .where(
      and(
        eq(projectMemberships.user_id, userId),
        eq(projectMemberships.project_id, projectId),
      ),
    )
    .returning({ project_id: projectMemberships.project_id });

  return deleted ? true : false;
}
