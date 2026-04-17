import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BriefFolder {
  id: string;
  org_id: string;
  project_id: string | null;
  parent_id: string | null;
  name: string;
  slug: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  document_count?: number;
}

interface FolderListResponse {
  data: BriefFolder[];
}

interface FolderResponse {
  data: BriefFolder;
}

export interface FolderTreeNode extends BriefFolder {
  children: FolderTreeNode[];
}

export function buildFolderTree(folders: BriefFolder[]): FolderTreeNode[] {
  const byId = new Map<string, FolderTreeNode>();
  for (const f of folders) {
    byId.set(f.id, { ...f, children: [] });
  }
  const roots: FolderTreeNode[] = [];
  for (const f of folders) {
    const node = byId.get(f.id)!;
    if (f.parent_id && byId.has(f.parent_id)) {
      byId.get(f.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

export function useFolders(projectId?: string | null) {
  return useQuery({
    queryKey: ['brief-folders', projectId ?? null],
    queryFn: () => api.get<FolderListResponse>('/folders', projectId ? { project_id: projectId } : undefined),
    select: (res) => res.data,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      project_id?: string | null;
      parent_id?: string | null;
      sort_order?: number;
    }) => api.post<FolderResponse>('/folders', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brief-folders'] });
    },
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; parent_id?: string | null; sort_order?: number }) =>
      api.patch<FolderResponse>(`/folders/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brief-folders'] });
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/folders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brief-folders'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
