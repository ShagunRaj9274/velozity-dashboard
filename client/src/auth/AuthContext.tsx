import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, refreshSession, setAccessToken, setSessionExpiredHandler, type Session } from '../lib/api';
import type { Role, User } from '../types';

type AuthState = { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; user: User };

interface AuthContextValue {
  state: AuthState;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const queryClient = useQueryClient();

  const endSession = useCallback(() => {
    setAccessToken(null);
    queryClient.clear();
    setState({ status: 'anonymous' });
  }, [queryClient]);

  // Restore the session on page load from the HttpOnly refresh cookie.
  useEffect(() => {
    setSessionExpiredHandler(endSession);
    refreshSession()
      .then((s) => setState({ status: 'authenticated', user: s.user }))
      .catch(() => setState({ status: 'anonymous' }));
  }, [endSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<Session>('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setState({ status: 'authenticated', user: data.user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo<AuthContextValue>(() => {
    const user = state.status === 'authenticated' ? state.user : null;
    return { state, user, login, logout, hasRole: (...roles) => !!user && roles.includes(user.role) };
  }, [state, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For components that only render when signed in. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser called while signed out');
  return user;
}
