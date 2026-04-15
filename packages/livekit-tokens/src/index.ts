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
