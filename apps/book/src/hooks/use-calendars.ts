import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Calendar {
  id: string;
  organization_id: string;
  owner_user_id: string | null;
  project_id: string | null;
  name: string;
  description: string | null;
  color: string;
  calendar_type: string;
  is_default: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

interface CalendarListResponse {
  data: Calendar[];
}

interface CalendarResponse {
  data: Calendar;
}

export function useCalendars(params?: { calendar_type?: string }) {
  return useQuery({
    queryKey: ['book', 'calendars', params],
    queryFn: () =>
      api.get<CalendarListResponse>('/v1/calendars', {
        calendar_type: params?.calendar_type,
      }),
    staleTime: 30_000,
  });
}

export function useCreateCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      color?: string;
      calendar_type?: string;
      timezone?: string;
      project_id?: string;
    }) => api.post<CalendarResponse>('/v1/calendars', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'calendars'] });
    },
  });
}

export function useUpdateCalendar(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Calendar>) =>
      api.patch<CalendarResponse>(`/v1/calendars/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'calendars'] });
    },
  });
}

export function useDeleteCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/calendars/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'calendars'] });
    },
  });
}
