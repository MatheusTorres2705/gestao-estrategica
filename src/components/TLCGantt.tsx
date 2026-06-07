import { cn } from '@/lib/utils';
import type { GanttRowData } from '@/services/tlcService';

const MESES_ABREV = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                         'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type Props = {
  rows: GanttRowData[];
  months: number[];
  ano: number;
  periodLabel: string;
  loading: boolean;
};

export function TLCGantt({ rows, months, ano, periodLabel, loading }: Props) {
  const anoShort = String(ano).slice(2);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 flex flex-col">
      <p className="text-sm font-bold text-slate-700 mb-4">
        Cronograma de Produção — {periodLabel}
      </p>

      <div className="overflow-x-auto flex-1">
        <div className="min-w-max">

          {/* Cabeçalho */}
          <div className="flex items-center mb-2">
            <div className="w-32 shrink-0" />
            {months.map(m => (
              <div
                key={m}
                className="w-16 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
              >
                {MESES_ABREV[m]}'{anoShort}
              </div>
            ))}
          </div>

          {/* Skeleton */}
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1 py-1.5 border-t border-gray-100">
              <div className="w-32 h-4 bg-gray-100 rounded animate-pulse shrink-0" />
              {months.map(m => (
                <div key={m} className="w-16 flex justify-center">
                  <div className="w-14 h-5 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ))}

          {/* Linhas de dados */}
          {!loading && rows.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-300">
              Nenhum apontamento no período
            </div>
          )}

          {!loading && rows.map((row) => (
            <div
              key={row.chassi}
              className="flex items-center py-1.5 border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div
                className="w-32 shrink-0 pr-2 text-xs font-medium text-gray-700 truncate"
                title={row.chassi}
              >
                {row.chassi}
              </div>
              {months.map((m) => {
                const active = row.activeMonths.includes(m);
                return (
                  <div key={m} className="w-16 flex justify-center">
                    <div
                      className={cn(
                        'w-14 h-5 rounded transition-colors',
                        active
                          ? 'bg-cyan-400 opacity-90'
                          : 'bg-gray-100',
                      )}
                      title={active ? `${row.chassi} — ${MESES_ABREV[m]}/${ano}` : undefined}
                    />
                  </div>
                );
              })}
            </div>
          ))}

        </div>
      </div>

      {!loading && rows.length > 0 && (
        <p className="mt-3 text-[10px] text-gray-400 border-t border-gray-100 pt-2">
          {rows.length} embarcação{rows.length !== 1 ? 'ões' : ''} com apontamento no período
        </p>
      )}
    </div>
  );
}
