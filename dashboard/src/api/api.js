import axios from 'axios';

const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL ?? '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // required for cookie-based auth
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isAuthRoute = error.config?.url?.includes('/auth/');
        if (error.response?.status === 401 && !isAuthRoute) {
            window.dispatchEvent(new Event('auth:unauthorized'));
        }
        return Promise.reject(error);
    }
);

// ─── Auth API ──────────────────────────────────────────────────────────────────
// Backend: POST /api/auth/login  → { username, password }
// Backend: GET  /api/auth/profile
// Backend: GET  /api/auth/logout
export const authApi = {
    login: async (credentials) => {
        // Backend loginSchema requires { username, password }
        const response = await api.post('/auth/login', credentials);
        return response.data;
    },
    getProfile: async (options) => {
        const response = await api.get('/auth/profile', { signal: options?.signal });
        return response.data;
    },
    // Backend uses GET /auth/logout (not POST)
    logout: async () => {
        const response = await api.get('/auth/logout');
        return response.data;
    },
    updateProfile: async (profileData) => {
        const response = await api.put('/auth/profile', profileData);
        return response.data;
    },
};

// ─── Analytics API ─────────────────────────────────────────────────────────────
// Backend: GET /api/analytics/dashboard  (mounted at /api/analytics)
// Backend: GET /api/analytics/stats
export const analyticsApi = {
    getDashboard: async (params) => {
        const response = await api.get('/analytics/dashboard', { params });
        const payload = response.data || {};

        payload.data = payload.data || {};

        payload.data.stats = payload.data.stats ?? {
            totalHits: 0,
            avgLatency: 0,
            errorRate: 0,
            errorHits: 0,
            successHits: 0,
            uniqueServices: 0,
            uniqueEndpoints: 0,
        };

        payload.data.topEndpoints = payload.data.topEndpoints ?? [];
        // backend returns recentActitivy (typo in backend), normalise here
        payload.data.recentActivity = payload.data.recentActitivy ?? payload.data.recentActivity ?? [];

        return payload;
    },
    getStats: async (params) => {
        const response = await api.get('/analytics/stats', { params });
        return response.data;
    },
};

// ─── Client / Admin API ────────────────────────────────────────────────────────
// Backend router is mounted at /api/client, then routes use /admin/clients/...
//   GET  /api/client/admin/clients          → list all clients (super admin)
//   GET  /api/client/admin/clients/:id      → get client by id
//   POST /api/client/admin/clients/onboard  → create client
//   POST /api/client/admin/clients/:id/users
//   POST /api/client/admin/clients/:id/api/keys
//   GET  /api/client/admin/clients/:id/api/keys
export const clientApi = {
    getClients: async (params) => {
        const response = await api.get('/client/admin/clients', { params });
        return response.data;
    },
    getClientById: async (clientId) => {
        const response = await api.get(`/client/admin/clients/${clientId}`);
        return response.data;
    },
    createClient: async (clientData) => {
        const response = await api.post('/client/admin/clients/onboard', clientData);
        return response.data;
    },
    createApiKey: async (clientId, keyData) => {
        const response = await api.post(`/client/admin/clients/${clientId}/api/keys`, keyData);
        return response.data;
    },
    getClientApiKeys: async (clientId) => {
        const response = await api.get(`/client/admin/clients/${clientId}/api/keys`);
        return response.data;
    },
    createClientUser: async (clientId, userData) => {
        const response = await api.post(`/client/admin/clients/${clientId}/users`, userData);
        return response.data;
    },
};

export default api;
