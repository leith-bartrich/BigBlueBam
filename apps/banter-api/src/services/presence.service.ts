import { eq, and, ne, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  banterUserPresence,
  banterChannelMemberships,
  users,
} from '../db/schema/index.js';
import { broadcastToOrg } from './realtime.js';

export type BanterPresenceStatus =
  | 'online'
  | 'idle'
  | 'in_call'
  | 'dnd'
  | 'offline';

export const PRESENCE_STATUSES: BanterPresenceStatus[] = [
  'online',
  'idle',
  'in_call',
  'dnd',
  'offline',
];

export interface PresenceRow {
  user_id: string;
  status: BanterPresenceStatus;
  in_call_channel_id: string | null;
  custom_status_text: string | null;
  custom_status_emoji: string | null;
  updated_at: Date;
  last_activity_at: Date;
}

export interface UpsertPresenceInput {
  user_id: string;
  status?: BanterPresenceStatus;
  in_call_channel_id?: string | null;
  custom_status_text?: string | null;
  custom_status_emoji?: string | null;
  touch_activity?: boolean;
}

/**
 * Insert-or-update a user's presence row. Only fields that are explicitly
 * provided are touched. `updated_at` always advances; `last_activity_at`
 * advances when `touch_activity` is true (default) or when `status` is set
 * to a non-offline value.
 */
export async function upsertPresence(input: UpsertPresenceInput): Promise<PresenceRow> {
  const now = new Date();
  const touchActivity =
    input.touch_activity ?? (input.status ? input.status !== 'offline' : true);

  const values = {
    user_id: input.user_id,
    status: input.status ?? 'online',
    in_call_channel_id: input.in_call_channel_id ?? null,
    custom_status_text: input.custom_status_text ?? null,
    custom_status_emoji: input.custom_status_emoji ?? null,
    updated_at: now,
    last_activity_at: touchActivity ? now : now,
  };

  const updateSet: Record<string, unknown> = {
    updated_at: now,
  };
  if (input.status !== undefined) updateSet.status = input.status;
  if (input.in_call_channel_id !== undefined) {
    updateSet.in_call_channel_id = input.in_call_channel_id;
  }
  if (input.custom_status_text !== undefined) {
    updateSet.custom_status_text = input.custom_status_text;
  }
  if (input.custom_status_emoji !== undefined) {
    updateSet.custom_status_emoji = input.custom_status_emoji;
  }
  if (touchActivity) {
    updateSet.last_activity_at = now;
  }

  const [row] = await db
    .insert(banterUserPresence)
    .values(values)
    .onConflictDoUpdate({
      target: banterUserPresence.user_id,
      set: updateSet,
    })
    .returning();

  return row as PresenceRow;
}

/**
 * Fetch the current presence row for a user, or synthesize an 'offline' row
 * if none exists yet. Never returns null.
 */
export async function getPresence(userId: string): Promise<PresenceRow> {
  const [row] = await db
    .select()
    .from(banterUserPresence)
    .where(eq(banterUserPresence.user_id, userId))
    .limit(1);

  if (row) return row as PresenceRow;

  const now = new Date();
  return {
    user_id: userId,
    status: 'offline',
    in_call_channel_id: null,
    custom_status_text: null,
    custom_status_emoji: null,
    updated_at: now,
    last_activity_at: now,
  };
}

/**
 * Return non-offline presence for every channel member of the given channel.
 * Used to power the channel presence indicator.
 */
export async function listChannelPresence(channelId: string): Promise<PresenceRow[]> {
  const rows = await db
    .select({
      user_id: banterUserPresence.user_id,
      status: banterUserPresence.status,
      in_call_channel_id: banterUserPresence.in_call_channel_id,
      custom_status_text: banterUserPresence.custom_status_text,
      custom_status_emoji: banterUserPresence.custom_status_emoji,
      updated_at: banterUserPresence.updated_at,
      last_activity_at: banterUserPresence.last_activity_at,
    })
    .from(banterUserPresence)
    .innerJoin(
      banterChannelMemberships,
      eq(banterChannelMemberships.user_id, banterUserPresence.user_id),
    )
    .where(
      and(
        eq(banterChannelMemberships.channel_id, channelId),
        ne(banterUserPresence.status, 'offline'),
      ),
    );

  return rows as PresenceRow[];
}

/**
 * Resolve org_id for a user so presence broadcasts can be scoped correctly.
 */
export async function getUserOrgId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ org_id: users.org_id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.org_id ?? null;
}

/**
 * Broadcast a presence change to the user's org channel. Consumers subscribe
 * at the org level because presence is visible across the whole workspace
 * sidebar.
 */
export function broadcastPresenceChange(orgId: string, row: PresenceRow) {
  broadcastToOrg(orgId, {
    type: 'presence.changed',
    data: {
      user_id: row.user_id,
      status: row.status,
      in_call_channel_id: row.in_call_channel_id,
      custom_status_text: row.custom_status_text,
      custom_status_emoji: row.custom_status_emoji,
      updated_at:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Used by the LiveKit participant-join webhook path: set the user to
 * in_call and record the channel so the UI can deep-link to it.
 */
export async function enterCall(userId: string, channelId: string): Promise<PresenceRow> {
  return upsertPresence({
    user_id: userId,
    status: 'in_call',
    in_call_channel_id: channelId,
  });
}

/**
 * LiveKit participant-leave webhook path: demote to online and clear the
 * channel_id. Does not touch custom status.
 */
export async function leaveCall(userId: string): Promise<PresenceRow> {
  return upsertPresence({
    user_id: userId,
    status: 'online',
    in_call_channel_id: null,
  });
}

/**
 * Get presence rows for many users at once (used when rendering member
 * lists or channel sidebars).
 */
export async function getPresenceBatch(
  userIds: string[],
): Promise<Record<string, PresenceRow>> {
  if (userIds.length === 0) return {};

  const rows = await db
    .select()
    .from(banterUserPresence)
    .where(inArray(banterUserPresence.user_id, userIds));

  const byUser: Record<string, PresenceRow> = {};
  for (const row of rows) byUser[row.user_id] = row as PresenceRow;
  return byUser;
}
