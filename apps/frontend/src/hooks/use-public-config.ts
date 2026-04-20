import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface PublicConfig {
  public_signup_disabled: boolean;
  bootstrap_required: boolean;
}

interface PublicConfigState {
  data: PublicConfig | null;
  isLoading: boolean;
}

/**
 * Fetches the unauthenticated /public/config payload once on mount. Returns
 * `isLoading: true` until the first response (or error) lands. On error,
 * resolves to a permissive default so the UI does not stall behind a
 * transient failure.
 */
export function usePublicConfig(): PublicConfigState {
  const [state, setState] = useState<PublicConfigState>({ data: null, isLoading: true });

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: PublicConfig }>('/public/config')
      .then((res) => {
        if (!cancelled) setState({ data: res.data, isLoading: false });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            data: { public_signup_disabled: false, bootstrap_required: false },
            isLoading: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
