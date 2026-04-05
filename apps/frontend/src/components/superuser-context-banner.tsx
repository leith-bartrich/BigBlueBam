import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { superuserApi } from '@/lib/api/superuser';

/**
 * Banner that appears when a SuperUser has context-switched into another org.
 * Shows which org they're viewing and provides a button to return to their home org.
 */
export function SuperuserContextBanner() {
  const { user, fetchMe } = useAuthStore();
  const queryClient = useQueryClient();
  const [clearing, setClearing] = useState(false);

  const isViewing =
    user?.is_superuser === true &&
    !!user.active_org_id &&
    !!user.org_id &&
    user.active_org_id !== user.org_id;

  const { data: orgDetail } = useQuery({
    queryKey: ['superuser', 'organizations', user?.active_org_id],
    queryFn: () => superuserApi.getOrganization(user!.active_org_id!),
    enabled: isViewing,
    staleTime: 60_000,
  });

  if (!isViewing) return null;

  const handleReturn = async () => {
    setClearing(true);
    try {
      await superuserApi.clearContext();
      await queryClient.invalidateQueries();
      await fetchMe();
      window.location.reload();
    } catch {
      setClearing(false);
    }
  };

  const orgName = orgDetail?.name ?? 'another organization';

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 text-sm">
      <div className="flex items-center gap-2 min-w-0 text-red-800 dark:text-red-300">
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Viewing <strong className="font-semibold">{orgName}</strong> as SuperUser
        </span>
      </div>
      <button
        onClick={handleReturn}
        disabled={clearing}
        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-700 text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
      >
        {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        Return to home org
      </button>
    </div>
  );
}
