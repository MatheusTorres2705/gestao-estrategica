import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Eye, EyeOff, Lock, User, Loader2 } from 'lucide-react';
import nxBoatsLogo from '@/assets/nx_boats.png';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !senha) return;
    setErr(null);
    setLoading(true);
    try {
      await login(usuario, senha);
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/dashboard';
      nav(from, { replace: true });
    } catch {
      setErr('Usuário ou senha inválidos. Verifique suas credenciais do Sankhya.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-lg px-8 py-8">
          {/* Logo */}
          <div className="mb-7 flex flex-col items-center gap-3">
            <img src={nxBoatsLogo} alt="NX Boats" className="h-12 w-auto" />
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900">Gestão Estratégica</h1>
              <p className="text-sm text-gray-500 mt-0.5">Painel da Diretoria</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Usuário</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="NOMUSU"
                  autoComplete="username"
                  required
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white pl-9 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {err && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-xs text-red-600">{err}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !usuario || !senha}
              className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                         shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Entrando…</> : 'Entrar'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-400">
            Use suas credenciais do sistema Sankhya
          </p>
        </div>
      </div>
    </div>
  );
}
