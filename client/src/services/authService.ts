/**
 * Auth service — wraps /api/auth endpoints.
 * Mirrors the exact response shapes returned by the Express backend.
 */
import api from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  role: 'super_admin' | 'client_admin' | 'client_viewer';
  clientId?: string;
  permissions?: {
    canCreateApiKeys: boolean;
    canManageUsers: boolean;
    canViewAnalytics: boolean;
    canExportData: boolean;
  };
}

// ── API calls ──────────────────────────────────────────────────────────────

/** POST /api/auth/login */
export async function login(payload: LoginPayload): Promise<UserProfile> {
  // API expects 'username' field, not 'email'
  const res = await api.post<{ data: UserProfile }>('/auth/login', {
    username: payload.email,
    password: payload.password,
  });
  return res.data.data;
}

/** GET /api/auth/profile */
export async function getProfile(): Promise<UserProfile> {
  const res = await api.get<{ data: UserProfile }>('/auth/profile');
  return res.data.data;
}

/** GET /api/auth/logout */
export async function logout(): Promise<void> {
  await api.get('/auth/logout');
}
