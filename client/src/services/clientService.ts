/**
 * Client service — wraps /api/client endpoints.
 * Mirrors clientController.js and clientService.js shapes.
 */
import api from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Client {
  _id: string;
  name: string;
  slug: string;
  email?: string;
  description?: string;
  website?: string;
  status?: 'active' | 'suspended' | 'pending';
  createdAt: string;
  updatedAt?: string;
  // Users are stored in MongoDB as sub-documents; the API may return a count
  userCount?: number;
}

export interface ApiKey {
  _id: string;
  keyId: string;
  // keyValue is intentionally omitted by backend on list calls
  name: string;
  description?: string;
  environment: 'production' | 'staging' | 'development';
  clientId: string;
  createdAt: string;
  createdBy: string;
  isActive?: boolean;
}

export interface CreateClientPayload {
  name: string;
  email?: string;
  description?: string;
  website?: string;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  role?: 'client_admin' | 'client_viewer';
}

export interface CreateApiKeyPayload {
  name: string;
  description?: string;
  environment?: 'production' | 'staging' | 'development';
}

// ── API calls ──────────────────────────────────────────────────────────────

/** POST /api/client/admin/clients/onboard */
export async function createClient(payload: CreateClientPayload): Promise<Client> {
  const res = await api.post<{ data: Client }>('/client/admin/clients/onboard', payload);
  return res.data.data;
}

/** GET /api/client/admin/clients */
export async function listClients(): Promise<Client[]> {
  const res = await api.get<{ data: Client[] }>('/client/admin/clients');
  return res.data.data ?? [];
}

/** GET /api/client/admin/clients/:clientId */
export async function getClientById(clientId: string): Promise<Client> {
  const res = await api.get<{ data: Client }>(`/client/admin/clients/${clientId}`);
  return res.data.data;
}

/** POST /api/client/admin/clients/:clientId/users */
export async function createClientUser(
  clientId: string,
  payload: CreateUserPayload
): Promise<{ _id: string; username: string; email: string; role: string }> {
  const res = await api.post(`/client/admin/clients/${clientId}/users`, payload);
  return res.data.data;
}

/** POST /api/client/admin/clients/:clientId/api/keys */
export async function createApiKey(
  clientId: string,
  payload: CreateApiKeyPayload
): Promise<ApiKey & { keyValue: string }> {
  // Backend returns keyValue only on creation, never again
  const res = await api.post(`/client/admin/clients/${clientId}/api/keys`, payload);
  return res.data.data;
}

/** GET /api/client/admin/clients/:clientId/api/keys */
export async function getClientApiKeys(clientId: string): Promise<ApiKey[]> {
  const res = await api.get<{ data: ApiKey[] }>(
    `/client/admin/clients/${clientId}/api/keys`
  );
  return res.data.data ?? [];
}
