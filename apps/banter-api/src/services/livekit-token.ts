import {
  mintRoomToken,
  buildAppRoomName,
  parseAppRoomName,
  type AppRoomNameParts,
} from '@bigbluebam/livekit-tokens';
import { env } from '../env.js';

/**
 * Thin shim over the shared @bigbluebam/livekit-tokens package. Was a
 * standalone jose-based JWT minter with a 1h TTL; now delegates to the
 * shared minter (livekit-server-sdk under the hood, 24h TTL by default
 * matching the rest of the suite). Same call sites; just one
 * implementation across Banter, Board, and any future caller.
 *
 * The `generateLiveKitToken` and `buildRoomName` shapes are preserved
 * for the existing call.routes.ts call sites — no churn there.
 */

export interface LiveKitTokenGrants {
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  hidden?: boolean;
}

export interface GenerateTokenOptions {
  participantIdentity: string;
  participantName: string;
  roomName: string;
  grants?: Partial<LiveKitTokenGrants>;
  ttlSeconds?: number;
}

export async function generateLiveKitToken(opts: GenerateTokenOptions): Promise<string> {
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new Error('LiveKit API key and secret are not configured');
  }
  return mintRoomToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: opts.participantIdentity,
    name: opts.participantName,
    roomName: opts.roomName,
    metadata: { name: opts.participantName },
    permissions: {
      can_publish: opts.grants?.canPublish ?? true,
      can_subscribe: opts.grants?.canSubscribe ?? true,
      can_publish_data: opts.grants?.canPublishData ?? true,
      hidden: opts.grants?.hidden ?? false,
    },
    ttlSeconds: opts.ttlSeconds,
  });
}

/**
 * Build a Banter-channel room name in the new app-agnostic format.
 * Existing `banter_<org>_<channel>_<call>` rooms keep working because
 * parseAppRoomName accepts both forms — but new calls use the
 * structured form so the webhook handler can route by orgId in O(1).
 */
export function buildRoomName(orgId: string, channelId: string, callId: string): string {
  return buildAppRoomName({
    app: 'banter',
    orgId,
    scopeType: 'channel',
    scopeId: channelId,
    callId,
  });
}

export { parseAppRoomName };
export type { AppRoomNameParts };
