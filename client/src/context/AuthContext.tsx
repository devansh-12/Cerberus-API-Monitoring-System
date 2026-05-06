/**
 * AuthContext — global session state.
 *
 * On mount it calls GET /api/auth/profile to rehydrate the session from the
 * server-side HttpOnly cookie.  All child components can read `user` and call
 * `logout()` without any prop-drilling.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getProfile, logout as apiLogout, login as apiLogin } from '../services/authService';
import type { LoginPayload, UserProfile } from '../services/authService';

// ── Types ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate session from cookie on first load
  useEffect(() => {
    getProfile()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const profile = await apiLogin(payload);
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, isLoading, isSuperAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
