import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BeaconAttachment {
  id: string;
  beacon_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  sort_order: number;
  uploaded_by: string;
  created_at: string;
  uploader_name: string | null;
  uploader_email: string | null;
  download_url: string | null;
}

interface AttachmentsResponse {
  data: BeaconAttachment[];
}

interface AttachmentResponse {
  data: BeaconAttachment;
}

/**
 * List attachments on a beacon. Each row carries a short-lived presigned URL
 * for preview/download. No extra round-trip required from the UI.
 */
export function useBeaconAttachments(beaconId: string | undefined) {
  return useQuery({
    queryKey: ['beacon-attachments', beaconId],
    queryFn: () => api.get<AttachmentsResponse>(`/beacons/${beaconId}/attachments`),
    enabled: !!beaconId,
    select: (res) => res.data,
  });
}

export function useUploadBeaconAttachment(beaconId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<AttachmentResponse>(`/beacons/${beaconId}/attachments`, formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beacon-attachments', beaconId] });
    },
  });
}

export function useDeleteBeaconAttachment(beaconId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      api.delete(`/beacons/${beaconId}/attachments/${attachmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beacon-attachments', beaconId] });
    },
  });
}
