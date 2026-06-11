import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck, Award, DollarSign, Factory, Layers, Package,
  BarChart3, ClipboardList, LogOut, ChevronRight, ChevronDown,
  X, Globe, CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';
import nxBoatsLogo from '@/assets/nx_boats.png';

// ── Definição dos grupos ──────────────────────────────────────────────────────

type NavItem = {
  to: string;
  label: string;
  comingSoon?: boolean;
};

type NavGroupDef = {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
};

type StandaloneItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  comingSoon?: boolean;
};

const NAV_GROUPS: NavGroupDef[] = [
  {
    id: 'weekly',
    label: 'Weekly',
    icon: CalendarDays,
    items: [
      { to: '/dashboard',                   label: 'Visão Geral'     },
      { to: '/indicadores/seguranca',       label: 'Segurança',       },
      { to: '/indicadores/qualidade',       label: 'Qualidade'        },
      { to: '/indicadores/tarifa-horaria',  label: 'Tarifa Horária'   },
      { to: '/indicadores/producao',        label: 'Produção / PCP'   },
      { to: '/indicadores/moldes',          label: 'Moldes'           },
      { to: '/indicadores/pcm',             label: 'PCM'              },
      { to: '/indicadores/working-capital', label: 'Working Capital'  },
      { to: '/indicadores/tlc',             label: 'TLC'              },
    ],
  },
];

const STANDALONE: StandaloneItem[] = [
  { to: '/planos-acao', label: 'Planos de Ação', icon: ClipboardList },
];

// ── Grupo colapsável ──────────────────────────────────────────────────────────

function NavGroup({ group, onClose }: { group: NavGroupDef; onClose: () => void }) {
  const location = useLocation();
  const hasActive = group.items.some(item => location.pathname === item.to || location.pathname.startsWith(item.to + '/'));
  const [open, setOpen] = useState(hasActive);
  const Icon = group.icon;

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-150"
      >
        <Icon className="h-[18px] w-[18px] shrink-0 text-gray-500" />
        <span className="flex-1 text-left">{group.label}</span>
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="mt-0.5 mb-1 pl-6 space-y-0.5">
          {group.items.map(item => {
            if (item.comingSoon) {
              return (
                <div
                  key={item.to}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-gray-300 cursor-default"
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] text-gray-300 leading-tight">em<br/>breve</span>
                </div>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'block rounded-xl px-3 py-2 text-sm transition-colors duration-150',
                    isActive
                      ? 'bg-gray-100 text-gray-900 font-semibold'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800',
                  )
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

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
      'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-white border-r border-gray-200 shadow-sm',
      'transform transition-transform duration-200 ease-in-out',
      'lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full',
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
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
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Menu
        </p>

        {/* Grupos */}
        {NAV_GROUPS.map(group => (
          <NavGroup key={group.id} group={group} onClose={onClose} />
        ))}

        {/* Separador + itens standalone */}
        {STANDALONE.length > 0 && (
          <>
            <div className="border-t border-gray-100 my-2" />
            {STANDALONE.map(({ to, label, icon: Icon, comingSoon }) => {
              if (comingSoon) {
                return (
                  <div
                    key={to}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-300 cursor-default"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1">{label}</span>
                    <span className="text-[10px] text-gray-300 leading-tight">em<br/>breve</span>
                  </div>
                );
              }
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-gray-100 text-gray-900 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-gray-700' : 'text-gray-400')} />
                      <span className="flex-1">{label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
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
