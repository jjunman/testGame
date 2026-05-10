import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { UserSummary } from '@band/shared-types';
import { api, tokenStorage } from '../api/client';
import { registerForPushNotificationsAsync } from '../notifications/pushNotifications';

type AuthContextValue = {
  user: UserSummary | null;
  loading: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  signup: (payload: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token = await tokenStorage.get();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const me = await api.get<UserSummary>('/auth/me');
        setUser(me);
      } catch {
        await tokenStorage.clear();
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    registerForPushNotificationsAsync();
  }, [user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (payload) => {
        const result = await api.post<{ accessToken: string; user: UserSummary }>('/auth/login', payload);
        await tokenStorage.set(result.accessToken);
        setUser(result.user);
      },
      signup: async (payload) => {
        const result = await api.post<{ accessToken: string; user: UserSummary }>('/auth/signup', payload);
        await tokenStorage.set(result.accessToken);
        setUser(result.user);
      },
      logout: async () => {
        await tokenStorage.clear();
        setUser(null);
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
