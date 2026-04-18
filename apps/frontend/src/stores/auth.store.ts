import { create } from 'zustand';
import type { User } from '@bigbluebam/shared';
import { api, ApiError } from '@/lib/api';

interface AuthError {
  message: string;
  cause?: string;
  requestId?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; display_name: string; org_name: string }) => Promise<void>;
  bootstrap: (data: { email: string; password: string; display_name: string; org_name: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

function toAuthError(err: unknown, fallback: string): AuthError {
  if (err instanceof ApiError) {
    const detailCause = err.details && err.details.length > 0
      ? (err.details[0] as any)?.message ?? JSON.stringify(err.details[0])
      : undefined;
    return {
      message: err.message,
      cause: detailCause,
      requestId: err.requestId,
    };
  }
  return { message: fallback };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ data: { user: User } }>('/auth/login', { email, password });
      set({ user: res.data.user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: toAuthError(err, 'Login failed') });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ data: { user: User } }>('/auth/register', data);
      set({ user: res.data.user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: toAuthError(err, 'Registration failed') });
      throw err;
    }
  },

  bootstrap: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ data: { user: User } }>('/auth/bootstrap', data);
      set({ user: res.data.user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: toAuthError(err, 'Bootstrap failed') });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore logout errors
    }
    set({ user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      const res = await api.getQuiet<{ data: User }>('/auth/me');
      set({ user: res.data, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
