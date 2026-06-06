import { useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Fish } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Indicador, Metrica, StatusBsc } from '@/types';
import { calcPctAtingimento, statusBscFromPct } from '@/types';
import { useNavigate } from 'react-router-dom';
import { AnalisesListModal } from '@/components/AnalisesListModal';

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<StatusBsc, { label: string; className: string }> = {
  'no-prazo': { label: 'No Prazo', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'atencao':  { label: 'Atenção',  className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'critico':  { label: 'Crítico',  className: 'bg-red-50 text-red-700 border border-red-200' },
};

function StatusPill({ pct, polaridade, valor, meta }: {
  pct: number;
  polaridade: Metrica['polaridade'];
  valor: number;
  meta: number;
}) {
  // Caso especial: meta = 0 e polaridade menor → atingido se valor = 0
  let effectivePct = pct;
  if (meta === 0 && polaridade === 'menor') effectivePct = valor === 0 ? 100 : 0;

  const status = statusBscFromPct(effectivePct);
  const cfg = STATUS_CFG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  );
}

// ── Polarity arrow ────────────────────────────────────────────────────────────

function PolarIcon({ polaridade }: { polaridade?: Metrica['polaridade'] }) {
  if (polaridade === 'maior') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (polaridade === 'menor') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

// ── % Atingimento cell ────────────────────────────────────────────────────────

function PctCell({ pct, meta, valor, polaridade }: {
  pct: number;
  meta: number;
  valor: number;
  polaridade?: Metrica['polaridade'];
}) {
  let effectivePct = pct;
  if (meta === 0 && polaridade === 'menor') effectivePct = valor === 0 ? 100 : 0;

  const color =
    effectivePct >= 95 ? 'text-emerald-600 font-semibold' :
    effectivePct >= 80 ? 'text-amber-600 font-semibold' :
    'text-red-600 font-semibold';

  return <span className={color}>{effectivePct.toFixed(1)}%</span>;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct, meta, valor, polaridade }: {
  pct: number;
  meta: number;
  valor: number;
  polaridade?: Metrica['polaridade'];
}) {
  let effectivePct = pct;
  if (meta === 0 && polaridade === 'menor') effectivePct = valor === 0 ? 100 : 0;

  const capped = Math.min(effectivePct, 100);
  const color =
    effectivePct >= 95 ? 'bg-emerald-500' :
    effectivePct >= 80 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${capped}%` }}
        />
      </div>
    </div>
  );
}

// ── Group header row ──────────────────────────────────────────────────────────

function GroupRow({
  indicador,
  open,
  onToggle,
  onIshikawa,
}: {
  indicador: Indicador;
  open: boolean;
  onToggle: () => void;
  onIshikawa: () => void;
}) {
  const nav = useNavigate();

  const numericMetrics = indicador.metricas.filter(
    (m) => typeof m.valor === 'number' && typeof m.meta === 'number'
  );
  const avgPct =
    numericMetrics.length === 0
      ? 0
      : numericMetrics.reduce((acc, m) => {
          const pct = calcPctAtingimento(
            m.valor as number,
            m.meta as number,
            m.polaridade ?? 'maior'
          );
          return acc + pct;
        }, 0) / numericMetrics.length;

  const overallStatus = statusBscFromPct(avgPct);
  const cfg = STATUS_CFG[overallStatus];

  return (
    <tr
      className="group bg-gray-50 border-t-2 border-gray-200 cursor-pointer select-none"
      onClick={onToggle}
    >
      {/* Indicador */}
      <td className="py-3 pl-4 pr-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">
            {open
              ? <ChevronDown className="h-4 w-4 text-blue-500" />
              : <ChevronRight className="h-4 w-4" />
            }
          </span>
          <span
            className="font-semibold text-sm text-gray-800 hover:text-blue-600 transition-colors"
            onClick={(e) => { e.stopPropagation(); nav(`/indicadores/${indicador.id}`); }}
          >
            {indicador.nome}
          </span>
        </div>
      </td>
      <td />
      <td />
      {/* Meta */}
      <td className="py-3 px-3 text-right text-sm text-gray-400">—</td>
      {/* Realizado */}
      <td className="py-3 px-3 text-right text-sm text-gray-400">—</td>
      {/* % Ating. */}
      <td className="py-3 px-3 text-right">
        <PctCell pct={avgPct} meta={1} valor={avgPct / 100} polaridade="maior" />
      </td>
      {/* Progresso */}
      <td className="py-3 px-4">
        <ProgressBar pct={avgPct} meta={1} valor={avgPct / 100} polaridade="maior" />
      </td>
      {/* Status */}
      <td className="py-3 px-3">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cfg.className)}>
          {cfg.label}
        </span>
      </td>
      {/* Responsável */}
      <td className="py-3 px-4 text-sm text-gray-400">—</td>
      {/* Ishikawa */}
      <td className="py-3 px-3 text-center">
        <button
          onClick={(e) => { e.stopPropagation(); onIshikawa(); }}
          title="Abrir Diagrama de Ishikawa"
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <Fish className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ── Metric row ────────────────────────────────────────────────────────────────

function MetricRow({ metrica, onIshikawa }: { metrica: Metrica; onIshikawa: () => void }) {
  if (typeof metrica.valor !== 'number' || typeof metrica.meta !== 'number') return null;

  const pct = calcPctAtingimento(metrica.valor, metrica.meta, metrica.polaridade ?? 'maior');

  const fmtVal = (v: number, unit?: string) => {
    if (unit === '%') return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
    if (unit === 'R$/h') return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
    return v.toLocaleString('pt-BR');
  };

  return (
    <tr className="border-t border-gray-100 hover:bg-blue-50/30 transition-colors">
      {/* Indicador */}
      <td className="py-2.5 pl-12 pr-3">
        <span className="text-sm text-gray-700">{metrica.label}</span>
      </td>
      {/* Unidade */}
      <td className="py-2.5 px-3 text-xs text-gray-400 text-center">{metrica.unidade ?? '—'}</td>
      {/* Polaridade */}
      <td className="py-2.5 px-3 text-center">
        <PolarIcon polaridade={metrica.polaridade} />
      </td>
      {/* Meta */}
      <td className="py-2.5 px-3 text-right text-sm text-gray-600">
        {fmtVal(metrica.meta as number, metrica.unidade)}
      </td>
      {/* Realizado */}
      <td className="py-2.5 px-3 text-right text-sm font-semibold text-gray-900">
        {fmtVal(metrica.valor as number, metrica.unidade)}
      </td>
      {/* % Ating. */}
      <td className="py-2.5 px-3 text-right">
        <PctCell pct={pct} meta={metrica.meta as number} valor={metrica.valor as number} polaridade={metrica.polaridade} />
      </td>
      {/* Progresso */}
      <td className="py-2.5 px-4">
        <ProgressBar pct={pct} meta={metrica.meta as number} valor={metrica.valor as number} polaridade={metrica.polaridade} />
      </td>
      {/* Status */}
      <td className="py-2.5 px-3">
        <StatusPill pct={pct} polaridade={metrica.polaridade} valor={metrica.valor as number} meta={metrica.meta as number} />
      </td>
      {/* Responsável */}
      <td className="py-2.5 px-4 text-sm text-gray-500">{metrica.responsavel ?? '—'}</td>
      {/* Ishikawa */}
      <td className="py-2.5 px-3 text-center">
        <button
          onClick={onIshikawa}
          title="Abrir Diagrama de Ishikawa"
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <Fish className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────

type Props = { indicadores: Indicador[]; mes: number; ano: number };

type IshikawaTarget = { indicadorId: string; indicadorNome: string };

export function BscTable({ indicadores, mes, ano }: Props) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [ishikawaTarget, setIshikawaTarget] = useState<IshikawaTarget | null>(null);

  const toggle = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-3 pl-4 pr-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Indicador</th>
              <th className="py-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center w-16">Unidade</th>
              <th className="py-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center w-16">Polar.</th>
              <th className="py-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right w-24">Meta</th>
              <th className="py-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right w-28">Realizado</th>
              <th className="py-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right w-24">% Ating.</th>
              <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500 w-36">Progresso</th>
              <th className="py-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 w-28">Status</th>
              <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Responsável</th>
              <th className="py-3 px-3 text-center w-12">
                <Fish className="h-3.5 w-3.5 text-gray-400 mx-auto" />
              </th>
            </tr>
          </thead>
          <tbody>
            {indicadores.map((indicador) => (
              <>
                <GroupRow
                  key={`group-${indicador.id}`}
                  indicador={indicador}
                  open={openGroups.has(indicador.id)}
                  onToggle={() => toggle(indicador.id)}
                  onIshikawa={() => setIshikawaTarget({ indicadorId: indicador.id, indicadorNome: indicador.nome })}
                />
                {openGroups.has(indicador.id) &&
                  indicador.metricas.map((m) => (
                    <MetricRow
                      key={m.id}
                      metrica={m}
                      onIshikawa={() => setIshikawaTarget({ indicadorId: indicador.id, indicadorNome: indicador.nome })}
                    />
                  ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {ishikawaTarget && (
        <AnalisesListModal
          indicadorId={ishikawaTarget.indicadorId}
          indicadorNome={ishikawaTarget.indicadorNome}
          mes={mes}
          ano={ano}
          onClose={() => setIshikawaTarget(null)}
        />
      )}
    </>
  );
}
