import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  api,
  getAccessToken,
  setAccessToken,
  startKeepAlive,
  stopKeepAlive,
  setOnUnauthorized,
} from '@/lib/api';

type User = {
  name: string;
  codusu?: number;
  codvend?: number;
  tipousuapp?: number;
};

type AuthCtx = {
  user: User | null;
  token: string | null;
  login: (usuario: string, senha: string) => Promise<void>;
  logout: () => void;
};

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split('.')[1];
    if (!b64) return null;
    return JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function parseJwtExpMs(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const expSec = Number(json?.exp);
    if (!expSec || Number.isNaN(expSec)) return null;
    return expSec * 1000;
  } catch {
    return null;
  }
}

const INACTIVITY_MS = 60 * 9 * 60 * 1000; // 9 horas

const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('pd_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [token, setToken] = React.useState<string | null>(() => getAccessToken());

  const logout = React.useCallback(() => {
    setAccessToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem('pd_user');
    delete api.defaults.headers.common['Authorization'];
    stopKeepAlive();
  }, []);

  React.useEffect(() => {
    setOnUnauthorized(() => logout());
    return () => setOnUnauthorized(null);
  }, [logout]);

  React.useEffect(() => {
    if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    else delete api.defaults.headers.common['Authorization'];
  }, [token]);

  React.useEffect(() => {
    if (token) startKeepAlive();
    return () => stopKeepAlive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Logout por inatividade
  React.useEffect(() => {
    if (!token) return;
    let timeoutId: number;
    const reset = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => logout(), INACTIVITY_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [token, logout]);

  // Logout quando JWT expira
  React.useEffect(() => {
    if (!token) return;
    const expMs = parseJwtExpMs(token);
    if (!expMs) return;
    const delay = expMs - Date.now() - 30_000;
    if (delay <= 0) { logout(); return; }
    const id = window.setTimeout(() => logout(), delay);
    return () => window.clearTimeout(id);
  }, [token, logout]);

  const login = async (usuario: string, senha: string) => {
    const { data } = await api.post<{
      token: string;
      name: string;
      usuario?: string;
      codusu?: number;
      codvend?: number;
      tipousuapp?: number | string;
    }>('/api/auth/login', { usuario, senha });

    if (!data.token) throw new Error('Token ausente no login');

    setAccessToken(data.token);
    setToken(data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

    const jwtPayload = parseJwtPayload(data.token);
    let codusu: number | undefined =
      data.codusu != null ? Number(data.codusu)
      : jwtPayload?.codusu != null ? Number(jwtPayload.codusu)
      : undefined;

    if (!codusu) {
      try {
        const safe = String(data.usuario ?? usuario).replace(/'/g, "''");
        const resp = await api.post<{ rows: Record<string, unknown>[] }>('/api/obter-reg', {
          consulta: `SELECT CODUSU FROM TSIUSU WHERE UPPER(USUARIO) = UPPER('${safe}')`,
          pageSize: 1, maxPages: 1,
        });
        const row = (resp.data?.rows ?? [])[0];
        const val = row ? Number(row.CODUSU ?? row.codusu ?? 0) : 0;
        if (val) codusu = val;
      } catch { /* segue sem codusu */ }
    }

    const u: User = {
      name: data.name,
      codusu,
      codvend: data.codvend,
      tipousuapp: data.tipousuapp == null ? undefined : Number(data.tipousuapp),
    };
    setUser(u);
    localStorage.setItem('pd_user', JSON.stringify(u));
    startKeepAlive();
  };

  const value: AuthCtx = { user, token, login, logout };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}
