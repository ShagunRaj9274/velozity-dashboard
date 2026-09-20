import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiErrorBody, User } from '../types';

/**
 * Token strategy
 *  • access token  → module-scoped variable (memory only; gone on reload)
 *  • refresh token → HttpOnly cookie set by the API (JS can never read it)
 * On reload, the app calls /auth/refresh to mint a new access token from the cookie.
 */
let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

const baseURL = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export const api = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

export interface Session {
  accessToken: string;
  user: User;
}

// Single-flight refresh: 10 requests failing at once trigger ONE refresh call.
let refreshing: Promise<Session> | null = null;
export function refreshSession(): Promise<Session> {
  refreshing ??= axios
    .post<Session>(`${baseURL}/auth/refresh`, null, { withCredentials: true })
    .then((res) => {
      setAccessToken(res.data.accessToken);
      return res.data;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthCall = original?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        setAccessToken(null);
        onSessionExpired?.();
      }
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from the API's structured error shape. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    const body = err.response?.data?.error;
    if (body?.details?.length) return `${body.message}: ${body.details.map((d) => `${d.field} — ${d.message}`).join('; ')}`;
    if (body?.message) return body.message;
    if (!err.response) return 'Cannot reach the server. Check your connection.';
  }
  return 'Something went wrong.';
}
