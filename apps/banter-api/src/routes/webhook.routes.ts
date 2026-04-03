import type { FastifyInstance } from 'fastify';
import { eq, and, sql, isNull, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  banterCalls,
  banterCallParticipants,
  banterChannels,
} from '../db/schema/index.js';
import { broadcastToChannel } from '../services/realtime.js';

/**
 * LiveKit webhook events.
 * See: https://docs.livekit.io/realtime/server/webhooks/
 */
interface LiveKitWebhookEvent {
  event: string;
  room?: {
    name: string;
    sid: string;
    numParticipants?: number;
  };
  participant?: {
    identity: string;
    sid: string;
    name?: string;
  };
  id?: string;
  createdAt?: number;
}

export default async function webhookRoutes(fastify: FastifyInstance) {
  // POST /v1/webhooks/livekit — receives LiveKit room events
  fastify.post('/v1/webhooks/livekit', async (request, reply) => {
    // LiveKit sends webhook events as JSON
    // In production, you should verify the webhook signature using the API key/secret.
    // For now we accept all events from the internal network.
    const event = request.body as LiveKitWebhookEvent;

    if (!event?.event) {
      return reply.status(400).send({ error: 'Missing event type' });
    }

    const roomName = event.room?.name;
    if (!roomName) {
      return reply.status(200).send({ ok: true });
    }

    fastify.log.info({ event: event.event, room: roomName }, 'LiveKit webhook received');

    switch (event.event) {
      case 'room_started':
        await handleRoomStarted(event);
        break;
      case 'participant_joined':
        await handleParticipantJoined(event);
        break;
      case 'participant_left':
        await handleParticipantLeft(event, fastify);
        break;
      case 'room_finished':
        await handleRoomFinished(event);
        break;
      default:
        fastify.log.debug({ event: event.event }, 'Unhandled LiveKit webhook event');
    }

    return reply.status(200).send({ ok: true });
  });
}

// ── Event handlers ───────────────────────────────────────────────

async function handleRoomStarted(event: LiveKitWebhookEvent) {
  const roomName = event.room!.name;
  const roomSid = event.room!.sid;

  // Update call record with the LiveKit room SID
  await db
    .update(banterCalls)
    .set({ livekit_room_sid: roomSid })
    .where(eq(banterCalls.livekit_room_name, roomName));
}

async function handleParticipantJoined(event: LiveKitWebhookEvent) {
  const roomName = event.room!.name;
  const participantIdentity = event.participant?.identity;
  if (!participantIdentity) return;

  // Find the call
  const [call] = await db
    .select()
    .from(banterCalls)
    .where(
      and(eq(banterCalls.livekit_room_name, roomName), eq(banterCalls.status, 'active')),
    )
    .limit(1);

  if (!call) return;

  // Check if participant already has an active record
  const [existing] = await db
    .select()
    .from(banterCallParticipants)
    .where(
      and(
        eq(banterCallParticipants.call_id, call.id),
        eq(banterCallParticipants.user_id, participantIdentity),
        isNull(banterCallParticipants.left_at),
      ),
    )
    .limit(1);

  if (!existing) {
    // Insert participant record (may have been created by join endpoint already)
    try {
      await db.insert(banterCallParticipants).values({
        call_id: call.id,
        user_id: participantIdentity,
        role: 'participant',
      });
    } catch {
      // Ignore constraint violations
    }
  }

  // Update peak count
  const [countRow] = await db
    .select({ count: sql<number>`count(DISTINCT ${banterCallParticipants.user_id})::int` })
    .from(banterCallParticipants)
    .where(
      and(
        eq(banterCallParticipants.call_id, call.id),
        isNull(banterCallParticipants.left_at),
      ),
    );

  const currentCount = countRow?.count ?? 0;
  if (currentCount > call.peak_participant_count) {
    await db
      .update(banterCalls)
      .set({ peak_participant_count: currentCount })
      .where(eq(banterCalls.id, call.id));
  }
}

async function handleParticipantLeft(
  event: LiveKitWebhookEvent,
  fastify: FastifyInstance,
) {
  const roomName = event.room!.name;
  const participantIdentity = event.participant?.identity;
  if (!participantIdentity) return;

  const [call] = await db
    .select()
    .from(banterCalls)
    .where(eq(banterCalls.livekit_room_name, roomName))
    .limit(1);

  if (!call) return;

  // Find the participant's active record
  const [participant] = await db
    .select()
    .from(banterCallParticipants)
    .where(
      and(
        eq(banterCallParticipants.call_id, call.id),
        eq(banterCallParticipants.user_id, participantIdentity),
        isNull(banterCallParticipants.left_at),
      ),
    )
    .orderBy(desc(banterCallParticipants.joined_at))
    .limit(1);

  if (participant) {
    const now = new Date();
    const joinedAt = new Date(participant.joined_at);
    const durationSeconds = Math.floor((now.getTime() - joinedAt.getTime()) / 1000);

    await db
      .update(banterCallParticipants)
      .set({ left_at: now, duration_seconds: durationSeconds })
      .where(eq(banterCallParticipants.id, participant.id));

    broadcastToChannel(call.channel_id, {
      type: 'call.participant_left',
      data: { call_id: call.id, user_id: participantIdentity },
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleRoomFinished(event: LiveKitWebhookEvent) {
  const roomName = event.room!.name;

  const [call] = await db
    .select()
    .from(banterCalls)
    .where(
      and(eq(banterCalls.livekit_room_name, roomName), eq(banterCalls.status, 'active')),
    )
    .limit(1);

  if (!call) return;

  const now = new Date();
  const startedAt = new Date(call.started_at);
  const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

  // End the call
  await db
    .update(banterCalls)
    .set({
      status: 'ended',
      ended_at: now,
      duration_seconds: durationSeconds,
    })
    .where(eq(banterCalls.id, call.id));

  // Mark all remaining participants as left
  await db
    .update(banterCallParticipants)
    .set({ left_at: now })
    .where(
      and(eq(banterCallParticipants.call_id, call.id), isNull(banterCallParticipants.left_at)),
    );

  // Clear active_huddle_id if huddle
  if (call.type === 'huddle') {
    await db
      .update(banterChannels)
      .set({ active_huddle_id: null })
      .where(eq(banterChannels.id, call.channel_id));
  }

  broadcastToChannel(call.channel_id, {
    type: 'call.ended',
    data: { call_id: call.id, duration_seconds: durationSeconds },
    timestamp: new Date().toISOString(),
  });
}
