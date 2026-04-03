import { create } from 'zustand';
import { api, ApiError } from '@/lib/api';

export interface BanterUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  org_id: string;
  presence: 'online' | 'idle' | 'dnd' | 'offline';
  role: string;
}

interface AuthState {
  user: BanterUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Verify session by calling Banter's auth check endpoint. */
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  fetchMe: async () => {
    try {
      // Use the BBB auth endpoint since Banter shares the same session
      const res = await fetch('/b3/api/auth/me', { credentials: 'include' });
      if (!res.ok) throw new Error('Not authenticated');
      const json = await res.json();
      const user = json.data;
      set({
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url ?? null,
          org_id: user.org_id,
          presence: 'online',
          role: user.role,
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
