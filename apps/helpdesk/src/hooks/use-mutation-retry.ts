import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * When the browser reconnects to the network, invalidate all queries so
 * stale data is refetched and any failed mutations surface again for retry.
 */
export function useMutationRetry() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      queryClient.invalidateQueries();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);
}
