import { useMutation, useQuery } from '@tanstack/react-query';

// Approvals are served by the Bam API at /b3/api/v1/approvals.
// We use fetch directly (not the Bill api client) because Bill's api
// client points at /bill/api. The user's Bam session cookie is shared
// across all SPAs under the same origin.

export interface BamUser {
  id: string;
  display_name: string;
  email: string;
}

export function useBamUsers() {
  return useQuery({
    queryKey: ['bill', 'bam-users'],
    queryFn: async () => {
      const res = await fetch('/b3/api/v1/users?active_only=true&limit=200', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return { data: [] as BamUser[] };
      const json = (await res.json()) as { data?: BamUser[] };
      return { data: json.data ?? [] };
    },
    staleTime: 60_000,
  });
}

interface ApprovalRequest {
  approver_id: string;
  subject_type: string;
  subject_id: string;
  body: string;
  url?: string;
}

export function useRequestApproval() {
  return useMutation({
    mutationFn: async (payload: ApprovalRequest) => {
      const res = await fetch('/b3/api/v1/approvals', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Request failed (${res.status})`);
      }
      return res.json() as Promise<{ data: { event_id: string } }>;
    },
  });
}
