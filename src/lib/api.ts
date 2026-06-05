import axios from 'axios';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://sankhya.nxboats.com.br:3200';

const TOKEN_KEY = 'pd_token';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common['Authorization'];
  }
}

const boot = getAccessToken();
if (boot) {
  api.defaults.headers.common['Authorization'] = `Bearer ${boot}`;
}

let keepAliveTimer: number | null = null;

export function startKeepAlive(intervalMs = 4 * 60 * 1000) {
  stopKeepAlive();
  keepAliveTimer = window.setInterval(async () => {
    try { await api.get('/api/whoami'); } catch { /* deixa o interceptor tratar 401 */ }
  }, intervalMs);
}

export function stopKeepAlive() {
  if (keepAliveTimer !== null) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

let onUnauthorized: ((reason?: string) => void) | null = null;

export function setOnUnauthorized(fn: ((reason?: string) => void) | null) {
  onUnauthorized = fn;
}

function isAuthRoute(url?: string) {
  return !!url && url.includes('/api/auth/login');
}

export async function obterReg<T = Record<string, unknown>>(
  consulta: string,
  opts?: { pageSize?: number; maxPages?: number },
): Promise<T[]> {
  const { data } = await api.post<{ rows?: T[]; items?: T[] }>('/api/obter-reg', {
    consulta,
    pageSize: opts?.pageSize ?? 10000,
    maxPages: opts?.maxPages ?? 10,
  });
  return data?.rows ?? data?.items ?? [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status as number | undefined;
    const url = error?.config?.url as string | undefined;
    if ((status === 401 || status === 403) && !isAuthRoute(url)) {
      setAccessToken(null);
      onUnauthorized?.('TOKEN_EXPIRED_OR_UNAUTHORIZED');
    }
    return Promise.reject(error);
  },
);
