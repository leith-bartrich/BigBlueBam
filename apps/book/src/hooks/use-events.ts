import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BookEvent {
  id: string;
  calendar_id: string;
  organization_id: string;
  title: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone: string;
  recurrence_rule: string | null;
  recurrence_end_at: string | null;
  recurrence_parent_id: string | null;
  status: string;
  visibility: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  booking_page_id: string | null;
  booked_by_name: string | null;
  booked_by_email: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  attendees?: Array<{
    id: string;
    user_id: string | null;
    email: string;
    name: string | null;
    response_status: string;
    is_organizer: boolean;
  }>;
}

interface EventListResponse {
  data: BookEvent[];
  total: number;
  limit: number;
  offset: number;
}

interface EventResponse {
  data: BookEvent;
}

export function useEvents(params: {
  start_after?: string;
  start_before?: string;
  calendar_ids?: string;
}) {
  return useQuery({
    queryKey: ['book', 'events', params],
    queryFn: () =>
      api.get<EventListResponse>('/v1/events', params),
    staleTime: 15_000,
    enabled: !!(params.start_after && params.start_before),
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['book', 'events', 'detail', id],
    queryFn: () => api.get<EventResponse>(`/v1/events/${id}`),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      calendar_id: string;
      title: string;
      start_at: string;
      end_at: string;
      description?: string;
      location?: string;
      meeting_url?: string;
      all_day?: boolean;
      timezone?: string;
      status?: string;
      visibility?: string;
      attendees?: Array<{ email: string; name?: string; user_id?: string }>;
    }) => api.post<EventResponse>('/v1/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'events'] });
    },
  });
}

export function useUpdateEvent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BookEvent>) =>
      api.patch<EventResponse>(`/v1/events/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'events'] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'events'] });
    },
  });
}

export function useRsvpEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { response_status: string }) =>
      api.post(`/v1/events/${eventId}/rsvp`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'events'] });
    },
  });
}
