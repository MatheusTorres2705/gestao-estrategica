import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Target } from 'lucide-react';
import { BscTable } from '@/components/BscTable';
import { getIndicadores } from '@/services/indicadoresService';
import { calcPctAtingimento, statusBscFromPct } from '@/types';
import type { Indicador } from '@/types';
import { fmtMesFull } from '@/lib/formatters';

type OutletCtx = { mes: number; ano: number };

const STATUS_LABEL = { 'no-prazo': 'No Prazo', 'atencao': 'Atenção', 'critico': 'Crítico' };
const STATUS_COLOR = {
  'no-prazo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'atencao':  'bg-amber-50 text-amber-700 border-amber-200',
  'critico':  'bg-red-50 text-red-700 border-red-200',
};

export default function DashboardPage() {
  const { mes, ano } = useOutletContext<OutletCtx>();
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);

  useEffect(() => {
    getIndicadores(mes, ano).then(setIndicadores);
  }, [mes, ano]);

  // Resumo global
  const counts = { 'no-prazo': 0, atencao: 0, critico: 0 };
  indicadores.forEach((ind) => {
    const numeric = ind.metricas.filter(
      (m) => typeof m.valor === 'number' && typeof m.meta === 'number'
    );
    if (!numeric.length) return;
    const avg =
      numeric.reduce(
        (s, m) => s + calcPctAtingimento(m.valor as number, m.meta as number, m.polaridade ?? 'maior'),
        0
      ) / numeric.length;
    const s = statusBscFromPct(avg);
    counts[s]++;
  });

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Page title */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shrink-0">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Metas e Indicadores</h1>
            <p className="text-sm text-gray-500">{fmtMesFull(mes)} / {ano} — Resultados da Fábrica</p>
          </div>
        </div>

        {/* Pills de resumo */}
        <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
          {(Object.entries(counts) as [keyof typeof counts, number][]).map(([key, count]) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_COLOR[key]}`}
            >
              <span className="text-base leading-none font-bold">{count}</span>
              {STATUS_LABEL[key]}
            </span>
          ))}
        </div>
      </div>

      {/* Tabela BSC */}
      {indicadores.length > 0
        ? <BscTable indicadores={indicadores} mes={mes} ano={ano} />
        : (
          <div className="flex items-center justify-center h-48">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )
      }
    </div>
  );
}
