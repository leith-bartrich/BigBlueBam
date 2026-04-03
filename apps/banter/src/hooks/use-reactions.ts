import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Toggle a reaction on a message (add if not present, remove if present) */
export function useToggleReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      channelId,
      messageId,
      emoji,
    }: {
      channelId: string;
      messageId: string;
      emoji: string;
    }) =>
      api.post(`/channels/${channelId}/messages/${messageId}/reactions`, { emoji }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.channelId] });
    },
  });
}
