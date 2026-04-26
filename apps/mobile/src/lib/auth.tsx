import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from './api';

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  trial_ends_at: string;
  subscription_status: string;
  referral_code: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: { email: string; password: string; username: string; tos_accepted: boolean; referral_code?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await SecureStore.getItemAsync('gammbler_token');
      if (token) {
        const res = await authAPI.me();
        setUser(res.data.user);
      }
    } catch {
      await SecureStore.deleteItemAsync('gammbler_token');
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await authAPI.signin({ email, password });
    await SecureStore.setItemAsync('gammbler_token', res.data.token);
    setUser(res.data.user);
  }, []);

  const signUp = useCallback(async (data: { email: string; password: string; username: string; tos_accepted: boolean; referral_code?: string }) => {
    const res = await authAPI.signup(data);
    await SecureStore.setItemAsync('gammbler_token', res.data.token);
    setUser(res.data.user);
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync('gammbler_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
