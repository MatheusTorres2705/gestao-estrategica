import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Award, DollarSign, Factory, Layers, Package, BarChart3,
  ChevronRight, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import type { Indicador } from '@/types';
import { StatusBadge, statusColor, statusGlow } from '@/components/StatusBadge';
import { SparkLine } from '@/components/TrendChart';
import { cn } from '@/lib/utils';

const ICONS: Record<string, React.ElementType> = {
  ShieldCheck, Award, DollarSign, Factory, Layers, Package, BarChart3,
};

type Props = {
  indicador: Indicador;
};

export function KpiCard({ indicador }: Props) {
  const nav = useNavigate();
  const Icon = ICONS[indicador.icone] ?? BarChart3;
  const primaryMetrica = indicador.metricas[0];
  const sparkColor = statusColor(indicador.status);

  const variacao = primaryMetrica?.variacao;
  const variacaoPositivaEBoa = indicador.id !== 'seguranca' && indicador.id !== 'qualidade';

  return (
    <button
      onClick={() => nav(`/indicadores/${indicador.id}`)}
      className={cn(
        'group relative w-full text-left rounded-2xl border border-white/7 bg-[#0C1523]',
        'p-5 transition-all duration-300',
        'hover:border-white/12 hover:bg-[#101D30] hover:-translate-y-0.5',
        statusGlow(indicador.status)
      )}
    >
      {/* Glow accent linha topo */}
      <div
        className="absolute inset-x-0 top-0 h-px rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${sparkColor}40, transparent)` }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${sparkColor}15`, border: `1px solid ${sparkColor}25` }}
          >
            <Icon className="h-5 w-5" style={{ color: sparkColor }} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm leading-tight">{indicador.nome}</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-tight">{indicador.resumo}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
      </div>

      {/* Métrica principal */}
      {primaryMetrica && (
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-2xl font-bold text-slate-100 leading-none">
              {typeof primaryMetrica.valor === 'number'
                ? primaryMetrica.valor.toLocaleString('pt-BR')
                : primaryMetrica.valor}
              {primaryMetrica.unidade === '%' && <span className="text-lg text-slate-400">%</span>}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Meta: {typeof primaryMetrica.meta === 'number'
                ? primaryMetrica.meta.toLocaleString('pt-BR')
                : primaryMetrica.meta}
              {primaryMetrica.unidade === '%' ? '%' : primaryMetrica.unidade ? ` ${primaryMetrica.unidade}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={indicador.status} size="sm" />
            {variacao !== undefined && (
              <span className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                variacao === 0 ? 'text-slate-400' :
                  variacaoPositivaEBoa
                    ? (variacao > 0 ? 'text-emerald-400' : 'text-red-400')
                    : (variacao > 0 ? 'text-red-400' : 'text-emerald-400')
              )}>
                {variacao === 0
                  ? <Minus className="h-3 w-3" />
                  : variacao > 0
                    ? <TrendingUp className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />
                }
                {Math.abs(variacao)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Sparkline */}
      <div className="h-10 -mx-1">
        <SparkLine data={indicador.tendencia} color={sparkColor} />
      </div>
    </button>
  );
}
