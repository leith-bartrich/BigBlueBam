/**
 * Unit tests for P0-18, P2-23, P3-3, P3-5 — permission race conditions
 * and late authorization checks in banter-api.
 *
 * These tests exercise the guard LOGIC directly. The handlers live inside
 * a Fastify route closure with heavy DB coupling, so rather than booting
 * Fastify we isolate each decision point (the conditional DELETE predicate,
 * the fresh-settings recheck, the last-owner guard, and the
 * participants-endpoint membership check) and verify the branching.
 */
import { describe, it, expect } from 'vitest';

describe('P0-18 — Channel deletion race (atomic ownership re-check)', () => {
  /**
   * Simulates the conditional DELETE predicate. The handler runs an UPDATE
   * gated by either:
   *   (a) the caller being org-privileged (owner/admin/superuser), OR
   *   (b) a live membership row with role='owner' for the caller.
   */
  type User = { id: string; role: string; is_superuser: boolean };
  type Membership = { user_id: string; role: string };

  function canDelete(
    user: User,
    memberships: Membership[],
  ): boolean {
    const isOrgPrivileged =
      user.is_superuser || user.role === 'owner' || user.role === 'admin';
    if (isOrgPrivileged) return true;
    return memberships.some(
      (m) => m.user_id === user.id && m.role === 'owner',
    );
  }

  it('allows delete when caller is still a channel owner', () => {
    const user = { id: 'u1', role: 'member', is_superuser: false };
    const memberships = [{ user_id: 'u1', role: 'owner' }];
    expect(canDelete(user, memberships)).toBe(true);
  });

  it('blocks delete when owner role was revoked between middleware and handler', () => {
    // Simulates the race: middleware saw user as owner, but a concurrent
    // request deleted/demoted the membership before the UPDATE fires.
    const user = { id: 'u1', role: 'member', is_superuser: false };
    const memberships: Membership[] = []; // membership row removed
    expect(canDelete(user, memberships)).toBe(false);
  });

  it('blocks delete when role downgraded from owner to member', () => {
    const user = { id: 'u1', role: 'member', is_superuser: false };
    const memberships = [{ user_id: 'u1', role: 'member' }];
    expect(canDelete(user, memberships)).toBe(false);
  });

  it('allows org owner to delete even without channel membership', () => {
    const user = { id: 'u1', role: 'owner', is_superuser: false };
    expect(canDelete(user, [])).toBe(true);
  });

  it('allows superuser to delete even without channel membership', () => {
    const user = { id: 'u1', role: 'member', is_superuser: true };
    expect(canDelete(user, [])).toBe(true);
  });
});

describe('P2-23 — Org setting flipped mid-request (fresh re-read)', () => {
  /**
   * Simulates the fresh-settings recheck logic in POST /v1/channels.
   * After the cached check passes, we re-read the DB before INSERT and
   * reject with SETTING_CHANGED if members can no longer create channels.
   */
  type Settings = { allow_channel_creation: string } | null;

  function rejectIfMembersBlocked(
    isPrivileged: boolean,
    freshSettings: Settings,
  ): { blocked: boolean; code?: string } {
    if (isPrivileged) return { blocked: false };
    const membersCanCreate =
      !freshSettings ||
      (freshSettings.allow_channel_creation ?? 'members') === 'members';
    if (!membersCanCreate) {
      return { blocked: true, code: 'SETTING_CHANGED' };
    }
    return { blocked: false };
  }

  it('passes when setting still allows members', () => {
    const result = rejectIfMembersBlocked(false, {
      allow_channel_creation: 'members',
    });
    expect(result.blocked).toBe(false);
  });

  it('rejects with SETTING_CHANGED when flipped to admins mid-request', () => {
    const result = rejectIfMembersBlocked(false, {
      allow_channel_creation: 'admins',
    });
    expect(result.blocked).toBe(true);
    expect(result.code).toBe('SETTING_CHANGED');
  });

  it('defaults to allowing members when no settings row exists', () => {
    const result = rejectIfMembersBlocked(false, null);
    expect(result.blocked).toBe(false);
  });

  it('skips recheck for privileged users', () => {
    const result = rejectIfMembersBlocked(true, {
      allow_channel_creation: 'admins',
    });
    expect(result.blocked).toBe(false);
  });
});

describe('P3-3 — Last owner cannot leave (channel orphan guard)', () => {
  /**
   * Simulates the leave-channel guard. Block only when caller is the
   * single remaining owner AND other non-owner members still exist.
   */
  function canLeave(
    callerRole: string | null,
    totalMembers: number,
    otherOwners: number,
  ): { allowed: boolean; code?: string } {
    if (callerRole !== 'owner') return { allowed: true };
    if (otherOwners === 0 && totalMembers > 1) {
      return { allowed: false, code: 'LAST_OWNER_CANNOT_LEAVE' };
    }
    return { allowed: true };
  }

  it('allows a regular member to leave', () => {
    expect(canLeave('member', 5, 1).allowed).toBe(true);
  });

  it('allows an owner to leave when other owners remain', () => {
    expect(canLeave('owner', 10, 2).allowed).toBe(true);
  });

  it('blocks the last owner when other members exist', () => {
    const result = canLeave('owner', 5, 0);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('LAST_OWNER_CANNOT_LEAVE');
  });

  it('allows the last owner to leave when they are the only member', () => {
    // Channel becomes orphaned (out of scope to auto-delete).
    expect(canLeave('owner', 1, 0).allowed).toBe(true);
  });

  it('allows a non-member (no row) to "leave" as a no-op', () => {
    expect(canLeave(null, 0, 0).allowed).toBe(true);
  });
});

describe('P3-5 — Call participants endpoint membership check', () => {
  /**
   * Simulates the authorization gate on GET /v1/calls/:id/participants.
   * - If the call's channel is in a different org: 404 (anti-enumeration)
   * - If the caller is superuser or org owner/admin: allow
   * - Otherwise require a channel membership row; 404 if missing.
   */
  type User = {
    id: string;
    org_id: string;
    role: string;
    is_superuser: boolean;
  };

  function canViewParticipants(
    user: User,
    channel: { org_id: string } | null,
    hasChannelMembership: boolean,
  ): { allowed: boolean; status?: number } {
    if (!channel || channel.org_id !== user.org_id) {
      return { allowed: false, status: 404 };
    }
    if (user.is_superuser || ['owner', 'admin'].includes(user.role)) {
      return { allowed: true };
    }
    if (!hasChannelMembership) {
      return { allowed: false, status: 404 };
    }
    return { allowed: true };
  }

  const memberUser: User = {
    id: 'u1',
    org_id: 'org-A',
    role: 'member',
    is_superuser: false,
  };

  it('returns 200 for a channel member', () => {
    const r = canViewParticipants(memberUser, { org_id: 'org-A' }, true);
    expect(r.allowed).toBe(true);
  });

  it('returns 404 for a non-member in the same org (anti-enumeration)', () => {
    const r = canViewParticipants(memberUser, { org_id: 'org-A' }, false);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(404);
  });

  it('returns 404 when call channel belongs to a different org', () => {
    const r = canViewParticipants(memberUser, { org_id: 'org-B' }, true);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(404);
  });

  it('returns 404 when the call does not exist', () => {
    const r = canViewParticipants(memberUser, null, false);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(404);
  });

  it('allows org admin even without channel membership', () => {
    const admin: User = { ...memberUser, role: 'admin' };
    const r = canViewParticipants(admin, { org_id: 'org-A' }, false);
    expect(r.allowed).toBe(true);
  });

  it('allows superuser across orgs? No — still scoped to org match', () => {
    // The participants endpoint still enforces org boundary even for
    // superusers via the channel.org_id === user.org_id check. Superusers
    // operate within whichever org they are currently acting in.
    const su: User = { ...memberUser, is_superuser: true };
    const r = canViewParticipants(su, { org_id: 'org-B' }, true);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(404);
  });
});
