import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CallSummary {
  id: string;
  channel_id: string;
  type: 'voice' | 'video' | 'huddle';
  status: 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
  started_by: string | null;
  livekit_room_name: string;
  transcription_enabled?: boolean;
  recording_enabled?: boolean;
  recording_url?: string | null;
}

export interface CallParticipant {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  left_at: string | null;
  has_audio: boolean;
  has_video: boolean;
  has_screen_share: boolean;
  is_bot: boolean;
  participation_mode: string;
}

export interface CallDetail extends CallSummary {
  channel_name: string;
  participants: CallParticipant[];
}

export interface TranscriptSegment {
  id: string;
  call_id: string;
  speaker_id: string;
  speaker_name: string;
  speaker_avatar_url: string | null;
  content: string;
  started_at: string;
  ended_at: string | null;
  confidence: number | null;
  is_final: boolean;
}

/** Call history for a channel (newest first). */
export function useChannelCalls(channelId: string | undefined) {
  return useQuery({
    queryKey: ['banter', 'calls', 'channel', channelId],
    queryFn: () =>
      api
        .get<{ data: CallSummary[] }>(`/channels/${channelId}/calls`)
        .then((r) => r.data),
    enabled: !!channelId,
  });
}

/** Single call detail with participants. */
export function useCallDetail(callId: string | undefined) {
  return useQuery({
    queryKey: ['banter', 'calls', 'detail', callId],
    queryFn: () =>
      api.get<{ data: CallDetail }>(`/calls/${callId}`).then((r) => r.data),
    enabled: !!callId,
  });
}

/** Transcript segments for a call, ordered by started_at. */
export function useCallTranscript(callId: string | undefined) {
  return useQuery({
    queryKey: ['banter', 'calls', 'transcript', callId],
    queryFn: () =>
      api
        .get<{ data: TranscriptSegment[] }>(`/calls/${callId}/transcript`)
        .then((r) => r.data),
    enabled: !!callId,
  });
}
