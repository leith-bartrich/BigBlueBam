import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface DataSource {
  product: string;
  entity: string;
  label: string;
  description: string;
  measures: { field: string; label: string; aggregations: string[]; type: string }[];
  dimensions: { field: string; label: string; type: string }[];
  filters: { field: string; label: string; operators: string[]; type: string; enumValues?: string[] }[];
  baseTable: string;
}

export function useDataSources() {
  return useQuery({
    queryKey: ['bench', 'data-sources'],
    queryFn: () => api.get<{ data: DataSource[] }>('/v1/data-sources'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDataSource(product: string, entity: string) {
  return useQuery({
    queryKey: ['bench', 'data-sources', product, entity],
    queryFn: () => api.get<{ data: DataSource }>(`/v1/data-sources/${product}/${entity}`),
    enabled: !!product && !!entity,
    staleTime: 5 * 60 * 1000,
  });
}
