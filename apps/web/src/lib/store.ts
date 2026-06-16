'use client';

import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  trial_ends_at: string;
  subscription_status: string;
  referral_code: string | null;
  tier?: 'free' | 'pro';
  verified_score_pass?: boolean;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setAuth: (user, token) => {
    localStorage.setItem('gammbler_token', token);
    localStorage.setItem('gammbler_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('gammbler_token');
    localStorage.removeItem('gammbler_user');
    set({ user: null, token: null, isAuthenticated: false });
    window.location.href = '/signin';
  },

  updateUser: (updates) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...updates };
      localStorage.setItem('gammbler_user', JSON.stringify(updated));
      return { user: updated };
    });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('gammbler_token');
    const userStr = localStorage.getItem('gammbler_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true });
      } catch {
        set({ user: null, token: null, isAuthenticated: false });
      }
    }
  },
}));
