import { SignJWT } from 'jose';
import { env } from '../env.js';

export interface LiveKitTokenGrants {
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  room?: string;
  roomJoin?: boolean;
  hidden?: boolean;
}

export interface GenerateTokenOptions {
  participantIdentity: string;
  participantName: string;
  roomName: string;
  grants?: Partial<LiveKitTokenGrants>;
  ttlSeconds?: number;
}

/**
 * Generate a LiveKit-compatible JWT access token.
 *
 * LiveKit expects a JWT with specific claims:
 *   - sub: participant identity
 *   - iss: API key
 *   - video: grant claims (room, roomJoin, canPublish, etc.)
 *   - nbf / exp: validity window
 *   - jti: unique token id
 */
export async function generateLiveKitToken(opts: GenerateTokenOptions): Promise<string> {
  const {
    participantIdentity,
    participantName,
    roomName,
    grants = {},
    ttlSeconds = 3600,
  } = opts;

  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new Error('LiveKit API key and secret are not configured');
  }

  const secret = new TextEncoder().encode(env.LIVEKIT_API_SECRET);
  const now = Math.floor(Date.now() / 1000);

  const videoGrants: Record<string, unknown> = {
    room: roomName,
    roomJoin: true,
    canPublish: grants.canPublish ?? true,
    canSubscribe: grants.canSubscribe ?? true,
    canPublishData: grants.canPublishData ?? true,
  };

  if (grants.hidden !== undefined) {
    videoGrants.hidden = grants.hidden;
  }

  const token = await new SignJWT({
    video: videoGrants,
    metadata: JSON.stringify({ name: participantName }),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(participantIdentity)
    .setIssuer(env.LIVEKIT_API_KEY)
    .setNotBefore(now)
    .setExpirationTime(now + ttlSeconds)
    .setJti(crypto.randomUUID())
    .sign(secret);

  return token;
}

/**
 * Build a standardised LiveKit room name.
 */
export function buildRoomName(orgId: string, channelId: string, callId: string): string {
  return `banter_${orgId}_${channelId}_${callId}`;
}
