import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShieldCheck, Award, DollarSign, Factory,
  Layers, Package, BarChart3, ClipboardList, LogOut, ChevronRight, X, Globe,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';
import nxBoatsLogo from '@/assets/nx_boats.png';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { to: '/indicadores/seguranca', label: 'Segurança', icon: ShieldCheck },
  { to: '/indicadores/qualidade', label: 'Qualidade', icon: Award },
  { to: '/indicadores/tarifa-horaria', label: 'Tarifa Horária', icon: DollarSign },
  { to: '/indicadores/producao', label: 'Produção / PCP', icon: Factory },
  { to: '/indicadores/moldes', label: 'Moldes', icon: Layers },
  { to: '/indicadores/pcm', label: 'PCM', icon: Package },
  { to: '/indicadores/working-capital', label: 'Working Capital', icon: BarChart3 },
  { to: '/indicadores/tlc', label: 'TLC', icon: Globe },
];

type Props = { open: boolean; onClose: () => void };

export function AppSidebar({ open, onClose }: Props) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = () => {
    logout();
    nav('/login', { replace: true });
  };

  return (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-white border-r border-gray-200 shadow-sm',
      'transform transition-transform duration-200 ease-in-out',
      'lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full',
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        {/* Botão fechar — visível só em mobile */}
        <button
          onClick={onClose}
          className="lg:hidden absolute right-3 top-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <img src={nxBoatsLogo} alt="NX Boats" className="h-8 w-auto" />
        <div>
          <p className="text-xs font-semibold text-gray-800 leading-tight">Gestão Estratégica</p>
          <p className="text-[10px] text-gray-400 leading-tight">Painel da Diretoria</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Indicadores
        </p>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600')} />
                <span className="flex-1 truncate">{label}</span>
                {isActive && <ChevronRight className="h-3 w-3 text-blue-400 shrink-0" />}
              </>
            )}
          </NavLink>
        ))}

        <div className="border-t border-gray-100 pt-3 mt-3">
          <NavLink
            to="/planos-acao"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <ClipboardList className={cn('h-4 w-4 shrink-0', isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600')} />
                <span className="flex-1">Planos de Ação</span>
                {isActive && <ChevronRight className="h-3 w-3 text-blue-400 shrink-0" />}
              </>
            )}
          </NavLink>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 shrink-0">
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{user?.name ?? 'Usuário'}</p>
            <p className="text-[10px] text-gray-400">NX Boats</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
