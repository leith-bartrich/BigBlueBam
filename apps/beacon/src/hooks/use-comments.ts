import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BeaconComment {
  id: string;
  beacon_id: string;
  parent_id: string | null;
  author_id: string;
  body_markdown: string;
  body_html: string | null;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  author_email: string | null;
  author_avatar_url: string | null;
}

interface CommentsResponse {
  data: BeaconComment[];
}

interface CommentResponse {
  data: BeaconComment;
}

/**
 * List all comments on a beacon. Returns rows in chronological order so the
 * consumer can flatten the tree in a single pass.
 */
export function useBeaconComments(beaconId: string | undefined) {
  return useQuery({
    queryKey: ['beacon-comments', beaconId],
    queryFn: () => api.get<CommentsResponse>(`/beacons/${beaconId}/comments`),
    enabled: !!beaconId,
    select: (res) => res.data,
  });
}

export function useCreateBeaconComment(beaconId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body_markdown: string; parent_id?: string | null }) =>
      api.post<CommentResponse>(`/beacons/${beaconId}/comments`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beacon-comments', beaconId] });
    },
  });
}

export function useDeleteBeaconComment(beaconId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete(`/beacons/${beaconId}/comments/${commentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beacon-comments', beaconId] });
    },
  });
}
