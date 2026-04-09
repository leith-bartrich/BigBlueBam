import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  board_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

interface ChatMessagesResponse {
  data: ChatMessage[];
}

interface ChatMessageResponse {
  data: ChatMessage;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useChatMessages(boardId: string | undefined) {
  return useQuery({
    queryKey: ['boards', boardId, 'chat'],
    queryFn: () => api.get<ChatMessagesResponse>(`/boards/${boardId}/chat`),
    enabled: !!boardId,
    refetchInterval: 5_000, // Poll every 5s for new messages
  });
}

export function useSendMessage(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) =>
      api.post<ChatMessageResponse>(`/boards/${boardId}/chat`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards', boardId, 'chat'] });
    },
  });
}
