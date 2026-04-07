import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────

export interface EffectivePolicy {
  min_days: number;
  max_days: number;
  default_days: number;
  grace_days: number;
}

export type PolicyScope = 'System' | 'Organization' | 'Project';

export interface PolicyRow {
  id: string;
  scope: PolicyScope;
  organization_id: string | null;
  project_id: string | null;
  min_expiry_days: number;
  max_expiry_days: number;
  default_expiry_days: number;
  grace_period_days: number;
  set_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PolicySavePayload {
  scope: PolicyScope;
  organization_id?: string;
  project_id?: string;
  min_expiry_days: number;
  max_expiry_days: number;
  default_expiry_days: number;
  grace_period_days: number;
}

interface PolicySaveResponse {
  data: PolicyRow;
  warnings?: { level: string; message: string }[];
}

interface EffectivePolicyResponse {
  data: EffectivePolicy;
}

// ── Hooks ────────────────────────────────────────────────────────────

/** Fetch the resolved effective policy for the current org, optionally scoped to a project. */
export function useEffectivePolicy(projectId?: string) {
  return useQuery({
    queryKey: ['beacon-policies', 'effective', projectId ?? 'org'],
    queryFn: () =>
      api.get<EffectivePolicyResponse>('/policies', {
        project_id: projectId,
      }),
    select: (res) => res.data,
  });
}

/** Preview the resolved policy for a specific project (Admin+ only). */
export function usePolicyResolve(projectId?: string) {
  return useQuery({
    queryKey: ['beacon-policies', 'resolve', projectId ?? 'org'],
    queryFn: () =>
      api.get<EffectivePolicyResponse>('/policies/resolve', {
        project_id: projectId,
      }),
    select: (res) => res.data,
    enabled: !!projectId,
  });
}

/** Save (create or update) a policy at the given scope. */
export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PolicySavePayload) =>
      api.put<PolicySaveResponse>('/policies', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beacon-policies'] });
    },
  });
}
