import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityType =
  | 'note'
  | 'email_sent'
  | 'email_received'
  | 'call'
  | 'meeting'
  | 'task'
  | 'stage_change'
  | 'deal_created'
  | 'deal_won'
  | 'deal_lost'
  | 'contact_created'
  | 'form_submission'
  | 'campaign_sent'
  | 'campaign_opened'
  | 'campaign_clicked'
  | 'custom';

export interface Activity {
  id: string;
  organization_id: string;
  contact_id: string | null;
  deal_id: string | null;
  company_id: string | null;
  activity_type: ActivityType;
  subject: string | null;
  body: string | null;
  metadata: Record<string, unknown>;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_at: string;
  created_at: string;
}

interface ActivityListResponse {
  data: Activity[];
  meta: { total: number; has_more: boolean; cursor: string | null };
}

interface ActivityResponse {
  data: Activity;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function activityTypeLabel(type: ActivityType): string {
  const labels: Record<ActivityType, string> = {
    note: 'Note',
    email_sent: 'Email Sent',
    email_received: 'Email Received',
    call: 'Call',
    meeting: 'Meeting',
    task: 'Task',
    stage_change: 'Stage Change',
    deal_created: 'Deal Created',
    deal_won: 'Deal Won',
    deal_lost: 'Deal Lost',
    contact_created: 'Contact Created',
    form_submission: 'Form Submission',
    campaign_sent: 'Campaign Sent',
    campaign_opened: 'Campaign Opened',
    campaign_clicked: 'Campaign Clicked',
    custom: 'Custom',
  };
  return labels[type] ?? type;
}

export function activityTypeColor(type: ActivityType): string {
  const colors: Record<string, string> = {
    note: '#64748b',
    email_sent: '#3b82f6',
    email_received: '#06b6d4',
    call: '#8b5cf6',
    meeting: '#f59e0b',
    task: '#f97316',
    stage_change: '#0891b2',
    deal_created: '#16a34a',
    deal_won: '#16a34a',
    deal_lost: '#dc2626',
    contact_created: '#6366f1',
    form_submission: '#ec4899',
    campaign_sent: '#d97706',
    campaign_opened: '#84cc16',
    campaign_clicked: '#22c55e',
    custom: '#94a3b8',
  };
  return colors[type] ?? '#64748b';
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useContactActivities(contactId: string | undefined) {
  return useQuery({
    queryKey: ['bond', 'activities', 'contact', contactId],
    queryFn: () => api.get<ActivityListResponse>(`/contacts/${contactId}/activities`),
    enabled: !!contactId,
    staleTime: 10_000,
  });
}

export function useDealActivities(dealId: string | undefined) {
  return useQuery({
    queryKey: ['bond', 'activities', 'deal', dealId],
    queryFn: () => api.get<ActivityListResponse>(`/deals/${dealId}/activities`),
    enabled: !!dealId,
    staleTime: 10_000,
  });
}

export function useCompanyActivities(companyId: string | undefined) {
  return useQuery({
    queryKey: ['bond', 'activities', 'company', companyId],
    queryFn: () => api.get<ActivityListResponse>(`/companies/${companyId}/activities`),
    enabled: !!companyId,
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useLogActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      activity_type: ActivityType;
      subject?: string;
      body?: string;
      contact_id?: string;
      deal_id?: string;
      company_id?: string;
      performed_at?: string;
      metadata?: Record<string, unknown>;
    }) => api.post<ActivityResponse>('/activities', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'activities'] });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/activities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'activities'] });
    },
  });
}
