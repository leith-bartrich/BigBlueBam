import { useQuery } from '@tanstack/react-query';

interface VersionInfo {
  current_commit: string;
  current_commit_short: string;
  build_date: string;
  latest_remote_commit: string | null;
  latest_remote_commit_short: string | null;
  latest_remote_date: string | null;
  latest_commit_message: string | null;
  update_available: boolean;
  checked_at: string | null;
}

export function useVersion() {
  return useQuery({
    queryKey: ['version'],
    queryFn: async () => {
      const res = await fetch('/b3/api/version');
      if (!res.ok) throw new Error('Version check failed');
      return res.json() as Promise<{ data: VersionInfo }>;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: false,
    select: (res) => res.data,
  });
}
