/**
 * Axios instance used by every service module.
 * - Sends cookies automatically (withCredentials)
 * - Redirects to /login on a 401 without looping
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,           // JWT lives in an HttpOnly cookie
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor: redirect to /login on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && globalThis.location.pathname !== '/login') {
      globalThis.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
