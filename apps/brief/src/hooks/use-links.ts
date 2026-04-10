import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TaskLink {
  id: string;
  document_id: string;
  task_id: string;
  link_type: string;
  created_by: string;
  created_at: string;
}

export interface BeaconLink {
  id: string;
  document_id: string;
  beacon_id: string;
  link_type: string;
  created_by: string;
  created_at: string;
}

interface LinksResponse {
  data: {
    task_links: TaskLink[];
    beacon_links: BeaconLink[];
  };
}

export function useLinks(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-links', documentId],
    queryFn: () => api.get<LinksResponse>(`/documents/${documentId}/links`),
    enabled: !!documentId,
    select: (res) => res.data,
  });
}
