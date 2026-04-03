import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Channel {
  id: string;
  slug: string;
  name: string;
  type: 'public' | 'private' | 'dm' | 'group_dm';
  topic: string | null;
  description: string | null;
  is_private: boolean;
  is_archived: boolean;
  is_default: boolean;
  member_count: number;
  created_at: string;
  created_by: string;
  last_message_at: string | null;
}

export interface ChannelMember {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  presence: string;
  role: 'owner' | 'admin' | 'member';
}

/** Fetch all channels the user is a member of */
export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get<{ data: Channel[] }>('/channels').then((r) => r.data),
  });
}

/** Fetch a single channel by slug or ID */
export function useChannel(slugOrId: string) {
  return useQuery({
    queryKey: ['channels', slugOrId],
    queryFn: () => api.get<{ data: Channel }>(`/channels/${slugOrId}`).then((r) => r.data),
    enabled: !!slugOrId,
  });
}

/** Fetch all public/browsable channels */
export function useBrowseChannels(search?: string) {
  return useQuery({
    queryKey: ['channels', 'browse', search],
    queryFn: () =>
      api
        .get<{ data: Channel[] }>('/channels/browse', { search: search || undefined })
        .then((r) => r.data),
  });
}

/** Fetch channel members */
export function useChannelMembers(channelId: string) {
  return useQuery({
    queryKey: ['channels', channelId, 'members'],
    queryFn: () =>
      api.get<{ data: ChannelMember[] }>(`/channels/${channelId}/members`).then((r) => r.data),
    enabled: !!channelId,
  });
}

/** Create a new channel */
export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; topic?: string; description?: string; is_private?: boolean }) =>
      api.post<{ data: Channel }>('/channels', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

/** Join a channel */
export function useJoinChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) =>
      api.post<{ data: Channel }>(`/channels/${channelId}/join`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

/** Leave a channel */
export function useLeaveChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => api.post(`/channels/${channelId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

/** Update a channel's settings */
export function useUpdateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, ...data }: { channelId: string; name?: string; topic?: string; description?: string; allow_bots?: boolean; allow_huddles?: boolean }) =>
      api.patch<{ data: Channel }>(`/channels/${channelId}`, data).then((r) => r.data),
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels', channel.slug] });
    },
  });
}

/** Update a channel member's role */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, userId, role }: { channelId: string; userId: string; role: 'admin' | 'member' }) =>
      api.patch(`/channels/${channelId}/members/${userId}`, { role }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['channels', vars.channelId, 'members'] });
    },
  });
}
