import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface WorkingHours {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  enabled: boolean;
}

interface WorkingHoursResponse {
  data: WorkingHours[];
}

export function useWorkingHours() {
  return useQuery({
    queryKey: ['book', 'working-hours'],
    queryFn: () => api.get<WorkingHoursResponse>('/v1/working-hours'),
    staleTime: 60_000,
  });
}

export function useSetWorkingHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hours: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      timezone?: string;
      enabled?: boolean;
    }>) => api.put<WorkingHoursResponse>('/v1/working-hours', hours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'working-hours'] });
    },
  });
}
