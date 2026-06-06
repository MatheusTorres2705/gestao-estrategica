import { ChevronDown, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type Props = {
  mes: number;
  ano: number;
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
  onMenuClick: () => void;
};

export function AppHeader({ mes, ano, onMesChange, onAnoChange, onMenuClick }: Props) {
  const today = new Date();
  const currentMes = today.getMonth() + 1;
  const currentAno = today.getFullYear();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-2 px-3 py-2 lg:px-6 lg:py-2.5 border-b border-gray-200 bg-white shadow-sm">
      {/* Hamburguer — visível só em mobile/tablet */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Lado esquerdo: toggles e seletor de ano */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
          <button className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            Mês Atual
          </button>
          <button className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
            Acumulado Ano
          </button>
        </div>

        {/* Seletor de ano */}
        <div className="relative">
          <select
            value={ano}
            onChange={(e) => onAnoChange(Number(e.target.value))}
            className="appearance-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 pr-7 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {[currentAno - 1, currentAno, currentAno + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        </div>
      </div>

      {/* Mobile: select de mês */}
      <div className="lg:hidden relative">
        <select
          value={mes}
          onChange={(e) => onMesChange(Number(e.target.value))}
          className="appearance-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 pr-7 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          {MESES.map((label, idx) => {
            const m = idx + 1;
            const isFuture = ano > currentAno || (ano === currentAno && m > currentMes);
            return (
              <option key={m} value={m} disabled={isFuture}>
                {label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
      </div>

      {/* Desktop: botões de mês em linha */}
      <div className="hidden lg:flex items-center gap-0.5">
        {MESES.map((label, idx) => {
          const m = idx + 1;
          const isCurrent = m === currentMes && ano === currentAno;
          const isSelected = m === mes;
          const isFuture = ano > currentAno || (ano === currentAno && m > currentMes);

          return (
            <button
              key={m}
              onClick={() => !isFuture && onMesChange(m)}
              disabled={isFuture}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isFuture
                    ? 'text-gray-300 cursor-not-allowed'
                    : isCurrent
                      ? 'text-blue-600 font-semibold hover:bg-blue-50'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
