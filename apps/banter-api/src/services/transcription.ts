import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { banterCallTranscripts, banterCalls } from '../db/schema/index.js';
import { broadcastToChannel } from './realtime.js';

/**
 * Write a transcript segment to the database and broadcast it in real-time.
 * Called by the voice agent service (via internal API) or webhook when STT produces output.
 */
export async function writeTranscriptSegment(params: {
  call_id: string;
  speaker_id: string;
  content: string;
  started_at: Date;
  ended_at?: Date;
  confidence?: number;
  is_final: boolean;
}): Promise<void> {
  const { call_id, speaker_id, content, started_at, ended_at, confidence, is_final } = params;

  // Insert the transcript segment
  const [segment] = await db
    .insert(banterCallTranscripts)
    .values({
      call_id,
      speaker_id,
      content,
      started_at,
      ended_at: ended_at ?? null,
      confidence: confidence ?? null,
      is_final,
    })
    .returning();

  // Find the call's channel to broadcast
  const [call] = await db
    .select({ channel_id: banterCalls.channel_id })
    .from(banterCalls)
    .where(eq(banterCalls.id, call_id))
    .limit(1);

  if (call && segment) {
    broadcastToChannel(call.channel_id, {
      type: 'call.transcript_segment',
      data: {
        call_id,
        segment: {
          id: segment.id,
          speaker_id,
          content,
          started_at: started_at.toISOString(),
          ended_at: ended_at?.toISOString() ?? null,
          confidence,
          is_final,
        },
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Post a full call summary message to the channel after call ends.
 * Aggregates all final transcript segments into a single message.
 */
export async function postCallTranscriptSummary(callId: string): Promise<void> {
  const segments = await db
    .select()
    .from(banterCallTranscripts)
    .where(
      and(
        eq(banterCallTranscripts.call_id, callId),
        eq(banterCallTranscripts.is_final, true),
      ),
    )
    .orderBy(banterCallTranscripts.started_at);

  if (segments.length === 0) return;

  // This could be enhanced to create a formatted transcript message
  // For now, the transcript is available via GET /calls/:id/transcript
}
