import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Message } from './use-messages';

/** Fetch thread replies for a parent message */
export function useThreadReplies(messageId: string) {
  return useQuery({
    queryKey: ['threads', messageId],
    queryFn: () =>
      api
        .get<{ data: Message[] }>(`/messages/${messageId}/thread`)
        .then((r) => r.data),
    enabled: !!messageId,
  });
}

/** Post a reply to a thread */
export function usePostThreadReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      content,
      alsoSendToChannel,
    }: {
      messageId: string;
      content: string;
      alsoSendToChannel?: boolean;
    }) =>
      api
        .post<{ data: Message }>(`/messages/${messageId}/thread`, {
          content,
          also_send_to_channel: alsoSendToChannel ?? false,
        })
        .then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['threads', variables.messageId] });
      // Also invalidate the channel messages to update thread_reply_count
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}
