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
      const res = await api.get<{ data: BanterUser }>('/me');
      set({ user: res.data, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      // If 401, redirect to BBB login
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = '/b3/login';
      }
    }
  },
}));
