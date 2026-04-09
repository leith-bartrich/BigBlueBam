import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AudioTokenResponse {
  data: {
    token: string;
    room_name: string;
    ws_url: string;
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch a LiveKit access token for the board's audio room.
 * Tokens are short-lived (1 hour) so we refresh every 10 minutes.
 */
export function useBoardAudioToken(boardId: string | undefined) {
  return useQuery({
    queryKey: ['board-audio-token', boardId],
    queryFn: () => api.post<AudioTokenResponse>(`/boards/${boardId}/audio/token`),
    staleTime: 10 * 60 * 1000, // 10 min
    refetchInterval: 10 * 60 * 1000, // auto-refresh before expiry
    enabled: !!boardId,
  });
}
