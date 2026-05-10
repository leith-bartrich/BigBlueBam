/**
 * LiveKit access-token mint helper shared across Banter, Board, and
 * voice-agent services.
 *
 * Wraps the LiveKit server SDK's AccessToken class with ergonomic
 * defaults: default permissions for publishers/subscribers, metadata
 * serialization, and a consistent 24-hour TTL. Services can still pass
 * explicit grants via `permissions` for fine-grained control.
 */

import { AccessToken } from 'livekit-server-sdk';

export interface RoomTokenPermissions {
  can_publish?: boolean;
  can_subscribe?: boolean;
  can_publish_data?: boolean;
  can_update_own_metadata?: boolean;
  room_admin?: boolean;
  room_create?: boolean;
  hidden?: boolean;
}

export interface MintRoomTokenOptions {
  identity: string;
  roomName: string;
  metadata?: Record<string, unknown>;
  permissions?: RoomTokenPermissions;
  ttlSeconds?: number;
  name?: string;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

export async function mintRoomToken(
  apiKey: string,
  apiSecret: string,
  options: MintRoomTokenOptions,
): Promise<string> {
  const at = new AccessToken(apiKey, apiSecret, {
    identity: options.identity,
    name: options.name,
    ttl: options.ttlSeconds ?? DEFAULT_TTL_SECONDS,
  });
  if (options.metadata) {
    at.metadata = JSON.stringify(options.metadata);
  }
  const perms = options.permissions ?? {};
  at.addGrant({
    room: options.roomName,
    roomJoin: true,
    canPublish: perms.can_publish ?? true,
    canSubscribe: perms.can_subscribe ?? true,
    canPublishData: perms.can_publish_data ?? true,
    canUpdateOwnMetadata: perms.can_update_own_metadata ?? true,
    roomAdmin: perms.room_admin ?? false,
    roomCreate: perms.room_create ?? false,
    hidden: perms.hidden ?? false,
  });
  return at.toJwt();
}

/**
 * App-agnostic LiveKit room name format. Designed so a webhook handler
 * receiving a LiveKit event can split on `__` and route in O(1) by
 * looking up the orgId — no per-org settings table scan. Each segment
 * is delimited by a double underscore so the embedded UUIDs (which
 * contain single hyphens) parse cleanly.
 *
 * Format: `bbb__<app>__<orgId>__<scopeType>__<scopeId>__<callId>`
 * Example: `bbb__banter__0fea63fe-…__channel__650b38cb-…__abcd1234-…`
 *
 * Banter's previous format `banter_<orgId>_<channelId>_<callId>` is
 * preserved by parseAppRoomName as a legacy path so in-flight calls
 * during the rollout don't fail webhook routing.
 */

export interface AppRoomNameParts {
  app: string;
  orgId: string;
  scopeType: string;
  scopeId: string;
  callId: string;
}

const ROOM_NAME_PREFIX = 'bbb';
const ROOM_NAME_DELIM = '__';

export function buildAppRoomName(parts: AppRoomNameParts): string {
  return [
    ROOM_NAME_PREFIX,
    parts.app,
    parts.orgId,
    parts.scopeType,
    parts.scopeId,
    parts.callId,
  ].join(ROOM_NAME_DELIM);
}

/**
 * Parse a room name into its parts. Returns null when the name doesn't
 * match either the new `bbb__…` form or the legacy Banter-only form.
 * The legacy path is recognized by an underscore-delimited prefix
 * `banter_<orgId>_<channelId>_<callId>` (single underscores).
 */
export function parseAppRoomName(name: string): AppRoomNameParts | null {
  if (!name) return null;
  if (name.startsWith(ROOM_NAME_PREFIX + ROOM_NAME_DELIM)) {
    const segs = name.split(ROOM_NAME_DELIM);
    if (segs.length !== 6) return null;
    const [, app, orgId, scopeType, scopeId, callId] = segs;
    if (!app || !orgId || !scopeType || !scopeId || !callId) return null;
    return { app, orgId, scopeType, scopeId, callId };
  }
  // Legacy Banter format. Preserved so webhook routing keeps working
  // for rooms that LiveKit still has open from before the rename.
  // We can drop this branch once no `banter_…` rooms have existed for
  // longer than LiveKit's empty-room timeout (typically 5 minutes).
  if (name.startsWith('banter_')) {
    const rest = name.slice('banter_'.length);
    // UUIDs are 36 chars including hyphens. The legacy format embedded
    // three of them with single underscores between, so we split into
    // exactly 3 chunks at the underscore boundaries.
    const parts = rest.split('_');
    if (parts.length !== 3) return null;
    const [orgId, channelId, callId] = parts;
    if (!orgId || !channelId || !callId) return null;
    return {
      app: 'banter',
      orgId,
      scopeType: 'channel',
      scopeId: channelId,
      callId,
    };
  }
  return null;
}
