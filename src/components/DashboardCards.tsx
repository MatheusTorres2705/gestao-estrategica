import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Award, DollarSign, Factory,
  Layers, Package, BarChart3, Globe, ChevronRight, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Indicador, Metrica } from '@/types';
import { calcPctAtingimento, statusBscFromPct } from '@/types';
import { OpeDetalhamentoModal } from '@/pages/OpeDetalhamentoModal';

const ICONS: Record<string, React.ElementType> = {
  ShieldCheck, Award, DollarSign, Factory, Layers, Package, BarChart3, Globe,
};

const STATUS_CFG = {
  'no-prazo': {
    label: 'No Prazo',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar:  'bg-emerald-500',
    ring: 'ring-emerald-200',
    icon: 'bg-emerald-600',
  },
  atencao: {
    label: 'Atenção',
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
    bar:  'bg-amber-500',
    ring: 'ring-amber-200',
    icon: 'bg-amber-500',
  },
  critico: {
    label: 'Crítico',
    pill: 'bg-red-50 text-red-700 border-red-200',
    bar:  'bg-red-500',
    ring: 'ring-red-200',
    icon: 'bg-red-500',
  },
};

function fmtVal(v: number, unit?: string) {
  if (unit === '%') return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  if (unit === 'R$/h') return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
  return v.toLocaleString('pt-BR');
}

function MiniBar({ pct, status }: { pct: number; status: keyof typeof STATUS_CFG }) {
  const capped = Math.min(pct, 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', STATUS_CFG[status].bar)}
        style={{ width: `${capped}%` }}
      />
    </div>
  );
}

function IndicadorCard({ indicador, onOpeDetalhe }: { indicador: Indicador; onOpeDetalhe?: () => void }) {
  const nav = useNavigate();
  const Icon = ICONS[indicador.icone] ?? BarChart3;

  const numericMetrics = indicador.metricas.filter(
    (m): m is Metrica & { valor: number; meta: number } =>
      typeof m.valor === 'number' && typeof m.meta === 'number',
  );

  const avgPct = numericMetrics.length === 0
    ? 0
    : numericMetrics.reduce(
        (s, m) => s + calcPctAtingimento(m.valor, m.meta, m.polaridade ?? 'maior'),
        0,
      ) / numericMetrics.length;

  const overallStatus = statusBscFromPct(avgPct);
  const cfg = STATUS_CFG[overallStatus];

  // Mostra até 3 métricas numéricas
  const preview = numericMetrics.slice(0, 3);

  return (
    <div
      className={cn(
        'rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow duration-200',
        'ring-1', cfg.ring,
        'cursor-pointer flex flex-col',
      )}
      onClick={() => nav(`/indicadores/${indicador.id}`)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', cfg.icon)}>
          <Icon className="h-4.5 w-4.5 text-white h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{indicador.nome}</p>
          <p className="text-xs text-gray-400">{numericMetrics.length} métricas</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', cfg.pill)}>
            {cfg.label}
          </span>
          <span className="text-xs font-semibold text-gray-500">{avgPct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Métricas */}
      <div className="flex-1 p-4 space-y-3">
        {preview.length === 0 ? (
          <p className="text-xs text-gray-300 italic">Sem métricas numéricas</p>
        ) : (
          preview.map((m) => {
            const pct = calcPctAtingimento(m.valor, m.meta, m.polaridade ?? 'maior');
            let ePct = pct;
            if (m.meta === 0 && m.polaridade === 'menor') ePct = m.valor === 0 ? 100 : 0;
            const st = statusBscFromPct(ePct);

            return (
              <div key={m.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-600 truncate flex-1">{m.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold text-gray-900">
                      {fmtVal(m.valor, m.unidade)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      / {fmtVal(m.meta, m.unidade)}
                    </span>
                  </div>
                </div>
                <MiniBar pct={ePct} status={st} />
              </div>
            );
          })
        )}
        {numericMetrics.length > 3 && (
          <p className="text-[10px] text-gray-400">+{numericMetrics.length - 3} métricas adicionais</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between">
        {onOpeDetalhe ? (
          <button
            onClick={(e) => { e.stopPropagation(); onOpeDetalhe(); }}
            className="flex items-center gap-1 text-xs text-indigo-500 font-medium hover:text-indigo-700 transition-colors"
          >
            <Activity className="h-3.5 w-3.5" />
            Detalhamento OPE
          </button>
        ) : <span />}
        <span className="flex items-center gap-0.5 text-xs text-blue-500 font-medium">
          Ver detalhe <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

type Props = { indicadores: Indicador[] };

export function DashboardCards({ indicadores }: Props) {
  const [opeOpen, setOpeOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {indicadores.map((ind) => (
          <IndicadorCard
            key={ind.id}
            indicador={ind}
            onOpeDetalhe={ind.id === 'producao' ? () => setOpeOpen(true) : undefined}
          />
        ))}
      </div>
      {opeOpen && <OpeDetalhamentoModal onClose={() => setOpeOpen(false)} />}
    </>
  );
}
