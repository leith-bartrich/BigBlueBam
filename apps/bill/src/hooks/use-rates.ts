import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRates(filters?: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ['rates', filters],
    queryFn: () => api.get<{ data: any[] }>('/v1/rates', filters),
    select: (res) => res.data,
  });
}

export function useCreateRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post<{ data: any }>('/v1/rates', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rates'] }),
  });
}

export function useUpdateRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => api.patch<{ data: any }>(`/v1/rates/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rates'] }),
  });
}

export function useDeleteRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/rates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rates'] }),
  });
}
