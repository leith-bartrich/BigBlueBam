import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useClients(filters?: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: () => api.get<{ data: any[] }>('/v1/clients', filters),
    select: (res) => res.data,
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get<{ data: any }>(`/v1/clients/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post<{ data: any }>('/v1/clients', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => api.patch<{ data: any }>(`/v1/clients/${id}`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', vars.id] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}
