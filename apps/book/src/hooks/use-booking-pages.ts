import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BookingPage {
  id: string;
  organization_id: string;
  owner_user_id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_min: number;
  buffer_after_min: number;
  max_advance_days: number;
  min_notice_hours: number;
  color: string | null;
  logo_url: string | null;
  confirmation_message: string | null;
  redirect_url: string | null;
  auto_create_bond_contact: boolean;
  auto_create_bam_task: boolean;
  bam_project_id: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface BookingPageListResponse {
  data: BookingPage[];
}

interface BookingPageResponse {
  data: BookingPage;
}

export function useBookingPage(id: string | undefined) {
  return useQuery({
    queryKey: ['book', 'booking-pages', 'detail', id],
    queryFn: () => api.get<BookingPageResponse>(`/v1/booking-pages/${id}`),
    enabled: !!id,
  });
}

export function useBookingPages() {
  return useQuery({
    queryKey: ['book', 'booking-pages'],
    queryFn: () => api.get<BookingPageListResponse>('/v1/booking-pages'),
    staleTime: 30_000,
  });
}

export function useCreateBookingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      slug: string;
      title: string;
      description?: string;
      duration_minutes?: number;
      buffer_before_min?: number;
      buffer_after_min?: number;
      color?: string;
    }) => api.post<BookingPageResponse>('/v1/booking-pages', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'booking-pages'] });
    },
  });
}

export function useUpdateBookingPage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BookingPage>) =>
      api.patch<BookingPageResponse>(`/v1/booking-pages/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'booking-pages'] });
    },
  });
}

export function useDeleteBookingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/booking-pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', 'booking-pages'] });
    },
  });
}
