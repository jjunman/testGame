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
const BOOTSTRAP_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, message: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), BOOTSTRAP_TIMEOUT_MS);
    }),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const token = await withTimeout(tokenStorage.get(), '저장된 로그인 정보를 확인하지 못했어요.');
        if (!token) {
          return;
        }

        const me = await withTimeout(api.get<UserSummary>('/auth/me'), '로그인 상태 확인이 지연되고 있어요.');
        if (mounted) {
          setUser(me);
        }
      } catch (error) {
        console.warn('[auth] bootstrap failed', error);
        tokenStorage.clear().catch(() => undefined);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
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
