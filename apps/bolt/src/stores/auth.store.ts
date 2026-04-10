import { create } from 'zustand';

export interface BoltUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  org_id: string;
  role: string;
  is_superuser?: boolean;
}

interface AuthState {
  user: BoltUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Verify session by calling Bam's auth check endpoint (shared session). */
  fetchMe: () => Promise<void>;
}

/** In-flight promise so concurrent callers share one request. */
let _fetchMePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  fetchMe: async () => {
    // If already authenticated, skip re-fetching
    const state = get();
    if (state.isAuthenticated && state.user) {
      set({ isLoading: false });
      return;
    }

    // Deduplicate concurrent calls — share a single in-flight request
    if (_fetchMePromise) {
      await _fetchMePromise;
      return;
    }

    const doFetch = async () => {
      const attempt = async (): Promise<Response> => {
        const res = await fetch('/b3/api/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Not authenticated');
        return res;
      };

      try {
        let res: Response;
        try {
          res = await attempt();
        } catch {
          // Retry once after 500ms delay
          await new Promise((r) => setTimeout(r, 500));
          res = await attempt();
        }

        const json = await res.json();
        const user = json.data;
        set({
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url ?? null,
            org_id: user.org_id,
            role: user.role,
            is_superuser: user.is_superuser === true,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      } finally {
        _fetchMePromise = null;
      }
    };

    _fetchMePromise = doFetch();
    await _fetchMePromise;
  },
}));

// Expose the store on a global so api.ts can read org_id without circular imports.
(globalThis as any).__boltAuthStore = useAuthStore;
