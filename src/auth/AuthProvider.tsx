import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type User = { name: string; codusu?: number; codvend?: number } | null;
type AuthCtx = {
  user: User;
  token: string | null;
  login: (usuario: string, senha: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa de <AuthProvider>');
  return ctx;
};

// TODO: remover mock quando reativar autenticação Sankhya
const MOCK_AUTH = true;
const MOCK_USER: User = { name: 'Usuário Demo', codusu: 0 };
const MOCK_TOKEN = 'mock-token-dev';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(
    MOCK_AUTH ? MOCK_USER : localStorage.getItem('auth:name') ? { name: localStorage.getItem('auth:name')! } : null
  );
  const [token, setToken] = useState<string | null>(
    MOCK_AUTH ? MOCK_TOKEN : localStorage.getItem('auth:token')
  );

  const login = async (usuario: string, senha: string) => {
    const { data } = await api.post('/api/auth/login', { usuario, senha });
    const { token: t, name, codusu, codvend } = data || {};
    if (!t) throw new Error('Token ausente no login');
    setUser({ name, codusu, codvend });
    setToken(t);
    localStorage.setItem('auth:token', t);
    localStorage.setItem('auth:name', name);
    api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
  };

  const logout = () => {
    api.post('/api/auth/logout').catch(() => {});
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth:token');
    localStorage.removeItem('auth:name');
    delete api.defaults.headers.common['Authorization'];
  };

  useEffect(() => {
    const handler = () => { setUser(null); setToken(null); };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const value = useMemo(() => ({ user, token, login, logout }), [user, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
