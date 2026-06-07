import { useEffect, useMemo, useState } from 'react';
import { BarChart2, Calendar, ChevronDown, ChevronLeft, Grid3x3, X, Zap } from 'lucide-react';
import {
  ComposedChart, Bar, Cell, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  getTransformacaoPorMes, agruparPorLinha,
  getMaterialDiretoPorMes, agruparMaterialPorLinha,
  getReceitaPorMes, agruparReceitaPorLinha,
  getTransformacaoPorPeriodo, getMaterialDiretoPorPeriodo, getReceitaPorPeriodo,
  PERIOD_DEFS, periodToDateRange,
} from '@/services/tlcService';
import type { TransformacaoRow, MaterialDiretoRow, ReceitaRow, PeriodKey, GanttRowData } from '@/services/tlcService';
import { TLCGantt } from '@/components/TLCGantt';

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtMi(v: number, decimals = 2): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '−R$ ' : 'R$ ';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(decimals)} mi`;
  if (abs >= 1_000)     return `${sign}${Math.round(abs / 1_000)} mil`;
  return `${sign}${abs.toFixed(2)}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${v}`;
}

// ── Dados mock (componentes ainda não integrados) ─────────────────────────────

const COMPOSICAO_BASE = [
  { label: 'Material direto', cor: '#94a3b8' },
  { label: 'Transformação',   cor: '#22d3ee' },  // ← valor real do serviço
  { label: 'Fretes entrada',  cor: '#e2e8f0' },
  { label: 'Fretes saída',    cor: '#93c5fd' },
  { label: 'SG&A',            cor: '#34d399' },
  { label: 'Garantia',        cor: '#818cf8' },
];

const PONTE_DRE = [
  { label: 'Receita bruta',     valor:  2_280_000, tipo: 'total'     },
  { label: '(-) Impostos',      valor:   -330_000, tipo: 'subtrair'  },
  { label: '= Receita líquida', valor:  1_950_000, tipo: 'subtotal'  },
  { label: '(-) CPV',           valor: -1_780_000, tipo: 'subtrair'  },
  { label: '= Lucro bruto',     valor:    170_000, tipo: 'subtotal'  },
  { label: '(-) Despesas',      valor:   -250_000, tipo: 'subtrair'  },
  { label: '= Lucro líquido',   valor:    -80_000, tipo: 'resultado' },
];

const MODELOS = ['Todos', 'NX 260', 'NX 290', 'NX 310', 'NX 340', 'NX 410', 'NX 440', 'NX 500'];

// ── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({ label, valor, negativo }: { label: string; valor: string; negativo?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col gap-1 min-w-0">
      <p className="text-xs text-gray-500 truncate">{label}</p>
      <p className={cn('text-2xl font-bold tracking-tight', negativo ? 'text-red-600' : 'text-gray-900')}>
        {valor}
      </p>
    </div>
  );
}

type ComposicaoItem = { label: string; valor: number; cor: string };

function ComposicaoBar({ itens, loading }: { itens: ComposicaoItem[]; loading: boolean }) {
  const total = itens.reduce((s, c) => s + c.valor, 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
      <p className="text-sm font-bold text-slate-700 mb-4">Composição do TLC</p>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex gap-4 items-stretch">
            {/* Barra empilhada vertical */}
            <div className="w-14 rounded-lg overflow-hidden flex flex-col-reverse shrink-0" style={{ height: 220 }}>
              {itens.map((c) => (
                <div
                  key={c.label}
                  style={{ height: total > 0 ? `${(c.valor / total) * 100}%` : '0%', backgroundColor: c.cor }}
                  title={`${c.label}: ${fmtMi(c.valor)}`}
                />
              ))}
            </div>
            {/* Legenda */}
            <div className="flex flex-col justify-between flex-1 py-0.5">
              {[...itens].reverse().map((c) => (
                <div key={c.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: c.cor }} />
                    <span className="text-xs text-gray-600 truncate">{c.label}</span>
                  </div>
                  <span className={cn(
                    'text-xs font-semibold tabular-nums whitespace-nowrap',
                    c.valor === 0 ? 'text-gray-300' : 'text-gray-800',
                  )}>
                    {c.valor === 0 ? '—' : fmtMi(c.valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 border-t border-gray-100 pt-2 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-500">Total</span>
            <span className="text-sm font-bold text-gray-900">{total > 0 ? fmtMi(total) : '—'}</span>
          </div>
        </>
      )}
    </div>
  );
}

function PonteDRE() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
      <p className="text-sm font-bold text-slate-700 mb-4">Ponte para a DRE</p>
      <div className="space-y-1">
        {PONTE_DRE.map((item) => {
          const isResultado = item.tipo === 'resultado';
          const isSubtotal  = item.tipo === 'subtotal';
          const isNeg       = item.valor < 0;

          return (
            <div
              key={item.label}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2',
                isResultado && isNeg  ? 'bg-red-50 border border-red-200'    :
                isResultado && !isNeg ? 'bg-green-50 border border-green-200' :
                isSubtotal            ? 'bg-slate-50 border border-slate-100' :
                                        '',
              )}
            >
              <span className={cn(
                'text-sm',
                isResultado ? 'font-bold' : isSubtotal ? 'font-semibold text-slate-700' : 'text-gray-600',
              )}>
                {item.label}
              </span>
              <span className={cn(
                'text-sm tabular-nums font-semibold',
                isResultado && isNeg  ? 'text-red-600 font-bold'   :
                isResultado && !isNeg ? 'text-green-600 font-bold'  :
                isNeg                 ? 'text-red-500'              :
                                        'text-gray-800',
              )}>
                {isNeg && item.tipo !== 'resultado' ? '' : ''}{fmtMi(item.valor)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tooltip customizado para o gráfico ────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: {name: string; value: number; color: string}[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.filter(p => p.name !== 'Receita líquida').reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="text-gray-600">{p.name}</span>
          </span>
          <span className="font-semibold tabular-nums text-gray-800">{fmtK(p.value)}</span>
        </div>
      ))}
      {payload.some(p => p.name !== 'Receita líquida') && (
        <div className="border-t border-gray-100 mt-1.5 pt-1.5 flex justify-between">
          <span className="text-gray-500">Custo total</span>
          <span className="font-bold text-gray-900">{fmtK(total)}</span>
        </div>
      )}
    </div>
  );
}

// ── View principal ────────────────────────────────────────────────────────────

type Props = { mes: number; ano: number };

// ── Sub-gráfico reutilizável ──────────────────────────────────────────────────

type ChartEntry = {
  label: string;
  transformacao: number;
  materialDireto: number;
  receitaLiquida: number;
  sga: number;
  garantia: number;
};

function CustoChart({
  data,
  selectedLabel,
  onBarClick,
}: {
  data: ChartEntry[];
  selectedLabel?: string | null;
  onBarClick?: (label: string) => void;
}) {
  const handleClick = (entry: ChartEntry) => onBarClick?.(entry.label);

  const cellFill = (baseColor: string, label: string) =>
    !selectedLabel || selectedLabel === label ? baseColor : `${baseColor}55`;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtK}
          tick={{ fontSize: 9, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

        <Bar dataKey="materialDireto" name="Material direto" stackId="custo" fill="#94a3b8" radius={[0,0,0,0]} cursor={onBarClick ? 'pointer' : 'default'} onClick={onBarClick ? handleClick : undefined}>
          {data.map(d => <Cell key={d.label} fill={cellFill('#94a3b8', d.label)} />)}
        </Bar>
        <Bar dataKey="transformacao" name="Transformação" stackId="custo" fill="#22d3ee" cursor={onBarClick ? 'pointer' : 'default'} onClick={onBarClick ? handleClick : undefined}>
          {data.map(d => <Cell key={d.label} fill={cellFill('#22d3ee', d.label)} />)}
        </Bar>
        <Bar dataKey="sga" name="SG&A" stackId="custo" fill="#34d399" cursor={onBarClick ? 'pointer' : 'default'} onClick={onBarClick ? handleClick : undefined}>
          {data.map(d => <Cell key={d.label} fill={cellFill('#34d399', d.label)} />)}
        </Bar>
        <Bar dataKey="garantia" name="Garantia" stackId="custo" fill="#818cf8" radius={[4,4,0,0]} cursor={onBarClick ? 'pointer' : 'default'} onClick={onBarClick ? handleClick : undefined}>
          {data.map(d => <Cell key={d.label} fill={cellFill('#818cf8', d.label)} />)}
        </Bar>

        <Line
          type="monotone"
          dataKey="receitaLiquida"
          name="Receita líquida"
          stroke="#f59e0b"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Grid de dados (alternativa ao gráfico) ────────────────────────────────────

const COLUNAS = [
  { key: 'materialDireto', label: 'Material direto', cor: '#94a3b8' },
  { key: 'transformacao',  label: 'Transformação',   cor: '#22d3ee' },
  { key: 'sga',            label: 'SG&A',            cor: '#34d399' },
  { key: 'garantia',       label: 'Garantia',        cor: '#818cf8' },
] as const;

function fmtBRL(v: number) {
  if (v === 0) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function CustoGrid({
  data,
  selectedLabel,
  onRowClick,
}: {
  data: ChartEntry[];
  selectedLabel?: string | null;
  onRowClick?: (label: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="py-2.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Linha / Chassi
            </th>
            {COLUNAS.map(c => (
              <th key={c.key} className="py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                <span className="flex items-center justify-end gap-1.5">
                  <span className="h-2 w-2 rounded-sm inline-block" style={{ backgroundColor: c.cor }} />
                  {c.label}
                </span>
              </th>
            ))}
            <th className="py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total custo
            </th>
            <th className="py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider text-amber-600">
              Receita líquida
            </th>
            <th className="py-2.5 px-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
              Margem
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const totalCusto = row.materialDireto + row.transformacao + row.sga + row.garantia;
            const margem = row.receitaLiquida - totalCusto;
            const margemPct = row.receitaLiquida > 0 ? (margem / row.receitaLiquida) * 100 : null;
            const isSelected = selectedLabel === row.label;

            return (
              <tr
                key={row.label}
                onClick={() => onRowClick?.(row.label)}
                className={cn(
                  'border-t border-gray-100 transition-colors',
                  onRowClick ? 'cursor-pointer' : '',
                  isSelected ? 'bg-blue-50' : 'hover:bg-gray-50',
                )}
              >
                <td className="py-2.5 pl-4 pr-3 font-medium text-gray-800 whitespace-nowrap">
                  {row.label}
                </td>
                {COLUNAS.map(c => (
                  <td key={c.key} className="py-2.5 px-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {fmtBRL(row[c.key])}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                  {fmtBRL(totalCusto)}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-amber-700 whitespace-nowrap">
                  {fmtBRL(row.receitaLiquida)}
                </td>
                <td className={cn(
                  'py-2.5 px-4 text-right tabular-nums font-semibold whitespace-nowrap',
                  margem >= 0 ? 'text-emerald-600' : 'text-red-600',
                )}>
                  {totalCusto === 0 && row.receitaLiquida === 0
                    ? '—'
                    : `${fmtBRL(margem)}${margemPct !== null ? ` (${margemPct.toFixed(1)}%)` : ''}`
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
        {data.length > 1 && (() => {
          const totMat   = data.reduce((s, r) => s + r.materialDireto, 0);
          const totTrans = data.reduce((s, r) => s + r.transformacao,  0);
          const totSga   = data.reduce((s, r) => s + r.sga,            0);
          const totGar   = data.reduce((s, r) => s + r.garantia,       0);
          const totCusto = totMat + totTrans + totSga + totGar;
          const totRec   = data.reduce((s, r) => s + r.receitaLiquida, 0);
          const totMarg  = totRec - totCusto;
          const totPct   = totRec > 0 ? (totMarg / totRec) * 100 : null;
          return (
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="py-2.5 pl-4 pr-3 text-xs text-gray-500 uppercase tracking-wider">Total</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-900">{fmtBRL(totMat)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-900">{fmtBRL(totTrans)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-900">{fmtBRL(totSga)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-900">{fmtBRL(totGar)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-900">{fmtBRL(totCusto)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-amber-700">{fmtBRL(totRec)}</td>
                <td className={cn('py-2.5 px-4 text-right tabular-nums', totMarg >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {fmtBRL(totMarg)}{totPct !== null ? ` (${totPct.toFixed(1)}%)` : ''}
                </td>
              </tr>
            </tfoot>
          );
        })()}
      </table>
    </div>
  );
}

// ── Toggle Chart/Grid ─────────────────────────────────────────────────────────

function ViewToggle({ view, onChange }: { view: 'chart' | 'grid'; onChange: (v: 'chart' | 'grid') => void }) {
  return (
    <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      <button
        onClick={() => onChange('chart')}
        title="Gráfico"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
          view === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600',
        )}
      >
        <BarChart2 className="h-3.5 w-3.5" />
        Gráfico
      </button>
      <button
        onClick={() => onChange('grid')}
        title="Grade"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
          view === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600',
        )}
      >
        <Grid3x3 className="h-3.5 w-3.5" />
        Grade
      </button>
    </div>
  );
}

// ── Helpers de período ────────────────────────────────────────────────────────

function mesToPeriod(mes: number): PeriodKey {
  if (mes <= 3) return 'Q1';
  if (mes <= 6) return 'Q2';
  if (mes <= 9) return 'Q3';
  return 'Q4';
}

function ModeToggle({ mode, onChange }: { mode: 'mes' | 'periodo'; onChange: (v: 'mes' | 'periodo') => void }) {
  return (
    <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      <button
        onClick={() => onChange('mes')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
          mode === 'mes' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600',
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        Por Mês
      </button>
      <button
        onClick={() => onChange('periodo')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
          mode === 'periodo' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600',
        )}
      >
        <BarChart2 className="h-3.5 w-3.5" />
        Ciclo Completo
      </button>
    </div>
  );
}

// ── View principal ────────────────────────────────────────────────────────────

export function TLCView({ mes, ano }: { mes: number; ano: number }) {
  const [modelo, setModelo]               = useState('Todos');
  const [selectedLinha, setSelectedLinha] = useState<string | null>(null);
  const [viewLinha, setViewLinha]         = useState<'chart' | 'grid'>('chart');
  const [viewDetalhe, setViewDetalhe]     = useState<'chart' | 'grid'>('chart');
  const [viewMode, setViewMode]           = useState<'mes' | 'periodo'>('mes');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>(() => mesToPeriod(mes));

  // Dados modo mês
  const [transformacaoRows, setTransformacaoRows] = useState<TransformacaoRow[]>([]);
  const [materialRows, setMaterialRows]           = useState<MaterialDiretoRow[]>([]);
  const [receitaRows, setReceitaRows]             = useState<ReceitaRow[]>([]);
  const [loadingTransfor, setLoadingTransfor]     = useState(false);
  const [loadingMaterial, setLoadingMaterial]     = useState(false);
  const [loadingReceita, setLoadingReceita]       = useState(false);

  // Dados modo período
  const [transforPeriodo, setTransforPeriodo] = useState<TransformacaoRow[]>([]);
  const [materialPeriodo, setMaterialPeriodo] = useState<MaterialDiretoRow[]>([]);
  const [receitaPeriodo, setReceitaPeriodo]   = useState<ReceitaRow[]>([]);
  const [loadingPeriodo, setLoadingPeriodo]   = useState(false);

  useEffect(() => {
    if (viewMode !== 'periodo') return;
    const { iniDate, fimDate } = periodToDateRange(selectedPeriod, ano);
    setLoadingPeriodo(true);
    setSelectedLinha(null);
    Promise.all([
      getTransformacaoPorPeriodo(iniDate, fimDate),
      getMaterialDiretoPorPeriodo(iniDate, fimDate),
      getReceitaPorPeriodo(iniDate, fimDate),
    ])
      .then(([t, m, r]) => {
        setTransforPeriodo(t);
        setMaterialPeriodo(m);
        setReceitaPeriodo(r);
      })
      .catch(() => {
        setTransforPeriodo([]); setMaterialPeriodo([]); setReceitaPeriodo([]);
      })
      .finally(() => setLoadingPeriodo(false));
  }, [viewMode, selectedPeriod, ano]);

  useEffect(() => {
    setSelectedLinha(null);

    setLoadingTransfor(true);
    getTransformacaoPorMes(mes, ano)
      .then(setTransformacaoRows)
      .catch(() => setTransformacaoRows([]))
      .finally(() => setLoadingTransfor(false));

    setLoadingMaterial(true);
    getMaterialDiretoPorMes(mes, ano)
      .then(setMaterialRows)
      .catch(() => setMaterialRows([]))
      .finally(() => setLoadingMaterial(false));

    setLoadingReceita(true);
    getReceitaPorMes(mes, ano)
      .then(setReceitaRows)
      .catch(() => setReceitaRows([]))
      .finally(() => setLoadingReceita(false));
  }, [mes, ano]);

  const loading = viewMode === 'mes'
    ? (loadingTransfor || loadingMaterial || loadingReceita)
    : loadingPeriodo;

  // Seleciona o conjunto de dados ativo conforme modo
  const tRows = viewMode === 'mes' ? transformacaoRows : transforPeriodo;
  const mRows = viewMode === 'mes' ? materialRows      : materialPeriodo;
  const rRows = viewMode === 'mes' ? receitaRows       : receitaPeriodo;

  const totalTransformacao = useMemo(
    () => tRows.reduce((s, r) => s + r.custoTransfor, 0),
    [tRows],
  );
  const totalMaterialDireto = useMemo(
    () => mRows.reduce((s, r) => s + r.custoMateriais, 0),
    [mRows],
  );
  const totalReceita = useMemo(
    () => rRows.reduce((s, r) => s + r.vlrReceita, 0),
    [rRows],
  );

  const composicaoReal = useMemo<ComposicaoItem[]>(() =>
    COMPOSICAO_BASE.map(c => {
      if (c.label === 'Transformação')   return { ...c, valor: totalTransformacao };
      if (c.label === 'Material direto') return { ...c, valor: totalMaterialDireto };
      return { ...c, valor: 0 };
    }),
    [totalTransformacao, totalMaterialDireto],
  );

  // Gráfico 1 — agrupado por linha (modo mês)
  const linhaData = useMemo((): ChartEntry[] => {
    const transforMap = new Map(agruparPorLinha(tRows).map(r => [r.descricao, r.custoTransfor]));
    const materialMap = new Map(agruparMaterialPorLinha(mRows).map(r => [r.descricao, r.custoMateriais]));
    const receitaMap  = new Map(agruparReceitaPorLinha(rRows).map(r => [r.descricao, r.vlrReceita]));

    const todasLinhas = Array.from(
      new Set([...transforMap.keys(), ...materialMap.keys(), ...receitaMap.keys()]),
    ).sort();

    const filtradas = modelo === 'Todos'
      ? todasLinhas
      : todasLinhas.filter(l => l.toUpperCase().includes(modelo.replace(' ', '')));

    return filtradas.map(label => ({
      label,
      transformacao:  transforMap.get(label) ?? 0,
      materialDireto: materialMap.get(label) ?? 0,
      receitaLiquida: receitaMap.get(label)  ?? 0,
      sga: 0, garantia: 0,
    }));
  }, [tRows, mRows, rRows, modelo]);

  // Gráfico Ciclo Completo — agrupado por chassi da linha selecionada
  const chassiPeriodoData = useMemo((): ChartEntry[] => {
    const agrupar = <T,>(rows: T[], keyFn: (r: T) => string, valFn: (r: T) => number) => {
      const map = new Map<string, number>();
      for (const r of rows) map.set(keyFn(r), (map.get(keyFn(r)) ?? 0) + valFn(r));
      return map;
    };

    const modeloFilter = (chassi: string) =>
      modelo === 'Todos' || chassi.toUpperCase().includes(modelo.replace(' ', '').toUpperCase());

    const transforFilt = transforPeriodo.filter(r => modeloFilter(r.chassi) && (!selectedLinha || r.descricao === selectedLinha));
    const materialFilt = materialPeriodo.filter(r => modeloFilter(r.chassi) && (!selectedLinha || r.descricao === selectedLinha));
    const receitaFilt  = receitaPeriodo.filter(r => modeloFilter(r.chassi) && (!selectedLinha || r.descricao === selectedLinha));

    const tMap = agrupar(transforFilt,  r => r.chassi, r => r.custoTransfor);
    const mMap = agrupar(materialFilt,  r => r.chassi, r => r.custoMateriais);
    const rMap = agrupar(receitaFilt,   r => r.chassi, r => r.vlrReceita);

    const todosChassis = Array.from(
      new Set([...tMap.keys(), ...mMap.keys(), ...rMap.keys()]),
    ).sort();

    return todosChassis.map(label => ({
      label,
      transformacao:  tMap.get(label) ?? 0,
      materialDireto: mMap.get(label) ?? 0,
      receitaLiquida: rMap.get(label) ?? 0,
      sga: 0, garantia: 0,
    }));
  }, [transforPeriodo, materialPeriodo, receitaPeriodo, modelo, selectedLinha]);

  // Gantt — meses ativos por chassi, filtrado pela linha selecionada
  const ganttData = useMemo((): GanttRowData[] => {
    if (viewMode !== 'periodo') return [];
    const modeloFilter = (chassi: string) =>
      modelo === 'Todos' || chassi.toUpperCase().includes(modelo.replace(' ', '').toUpperCase());
    const map = new Map<string, { descricao: string; activeMonths: Set<number> }>();
    for (const row of transforPeriodo) {
      if (!row.referencia || row.custoTransfor <= 0 || !modeloFilter(row.chassi)) continue;
      if (selectedLinha && row.descricao !== selectedLinha) continue;
      const mesNum = parseInt(row.referencia.split('/')[0], 10);
      if (!map.has(row.chassi)) map.set(row.chassi, { descricao: row.descricao, activeMonths: new Set() });
      map.get(row.chassi)!.activeMonths.add(mesNum);
    }
    return Array.from(map.entries())
      .map(([chassi, v]) => ({
        chassi,
        descricao: v.descricao,
        activeMonths: Array.from(v.activeMonths).sort((a, b) => a - b),
      }))
      .sort((a, b) => a.chassi.localeCompare(b.chassi));
  }, [viewMode, transforPeriodo, modelo, selectedLinha]);

  // Gráfico 2 — drill-down por chassi da linha selecionada
  const chassiDetalheData = useMemo((): ChartEntry[] => {
    if (!selectedLinha) return [];

    const agrupar = <T,>(
      rows: T[],
      keyFn: (r: T) => string,
      valFn: (r: T) => number,
    ) => {
      const map = new Map<string, number>();
      for (const r of rows) {
        const k = keyFn(r);
        map.set(k, (map.get(k) ?? 0) + valFn(r));
      }
      return map;
    };

    const transforFilt  = transformacaoRows.filter(r => r.descricao === selectedLinha);
    const materialFilt  = materialRows.filter(r => r.descricao === selectedLinha);
    const receitaFilt   = receitaRows.filter(r => r.descricao === selectedLinha);

    const transforMap  = agrupar(transforFilt,  r => r.chassi, r => r.custoTransfor);
    const materialMap  = agrupar(materialFilt,  r => r.chassi, r => r.custoMateriais);
    const receitaMap   = agrupar(receitaFilt,   r => r.chassi, r => r.vlrReceita);

    const todosChassis = Array.from(
      new Set([...transforMap.keys(), ...materialMap.keys(), ...receitaMap.keys()]),
    ).sort();

    return todosChassis.map(label => ({
      label,
      transformacao:  transforMap.get(label)  ?? 0,
      materialDireto: materialMap.get(label)  ?? 0,
      receitaLiquida: receitaMap.get(label)   ?? 0,
      sga: 0, garantia: 0,
    }));
  }, [selectedLinha, transformacaoRows, materialRows, receitaRows]);

  return (
    <div className="space-y-4">

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Toggle Por Mês / Ciclo Completo */}
        <ModeToggle
          mode={viewMode}
          onChange={(v) => {
            if (v === 'periodo') setSelectedPeriod(mesToPeriod(mes));
            setViewMode(v);
            setSelectedLinha(null);
          }}
        />

        {/* Modelo */}
        <div className="relative">
          <select
            value={modelo}
            onChange={e => { setModelo(e.target.value); setSelectedLinha(null); }}
            className="appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
          >
            {MODELOS.map(m => <option key={m} value={m}>Modelo: {m}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        </div>

        {/* Seletor de período (só no modo Ciclo Completo) */}
        {viewMode === 'periodo' && (
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value as PeriodKey)}
              className="appearance-none rounded-lg border border-blue-200 bg-blue-50 pl-3 pr-8 py-1.5 text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
            >
              {(Object.entries(PERIOD_DEFS) as [PeriodKey, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400" />
          </div>
        )}

        {viewMode === 'mes' && (
          <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
            FY {ano}
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Receita bruta"         valor={loadingReceita  ? '...' : totalReceita > 0          ? fmtMi(totalReceita)          : '—'} />
        <KpiCard label="Material direto"        valor={loadingMaterial ? '...' : totalMaterialDireto > 0   ? fmtMi(totalMaterialDireto)   : '—'} />
        <KpiCard label="Custo de Transformação" valor={loadingTransfor ? '...' : totalTransformacao > 0    ? fmtMi(totalTransformacao)    : '—'} />
        <KpiCard label="Tarifa h. transf."      valor="—" />
      </div>

      {/* Composição + Ponte DRE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComposicaoBar itens={composicaoReal} loading={loading} />
        <PonteDRE />
      </div>

      {/* Modo Ciclo Completo */}
      {viewMode === 'periodo' && (() => {
        const periodDef = PERIOD_DEFS[selectedPeriod];
        const periodMonths = Array.from(
          { length: periodDef.mesFim - periodDef.mesIni + 1 },
          (_, i) => periodDef.mesIni + i,
        );

        /* — Nível 1: por linha de produto (sem linha selecionada) — */
        if (!selectedLinha) return (
          <div className="rounded-xl border border-blue-100 bg-white shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <p className="text-sm font-bold text-slate-700">
                  Custo por linha de produto{modelo !== 'Todos' ? ` — ${modelo}` : ''}
                </p>
                <p className="text-xs text-blue-500 mt-0.5">
                  {periodDef.label} · {ano} — clique numa barra para detalhar por embarcação
                </p>
              </div>
              <ViewToggle view={viewLinha} onChange={setViewLinha} />
            </div>
            {loadingPeriodo ? (
              <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
            ) : linhaData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                Nenhum dado no período selecionado
              </div>
            ) : viewLinha === 'chart' ? (
              <CustoChart data={linhaData} onBarClick={setSelectedLinha} />
            ) : (
              <CustoGrid data={linhaData} onRowClick={setSelectedLinha} />
            )}
          </div>
        );

        /* — Nível 2: por embarcação da linha + Gantt (com linha selecionada) — */
        return (
          <div className="space-y-4">
            {/* Breadcrumb / voltar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedLinha(null)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <ChevronLeft className="h-4 w-4" />
                Todas as linhas
              </button>
              <span className="text-gray-300">/</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
                {selectedLinha}
                <button
                  onClick={() => setSelectedLinha(null)}
                  className="ml-0.5 rounded-full hover:bg-blue-100 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
              {/* Esquerda — custo por embarcação */}
              <div className="rounded-xl border border-blue-100 bg-white shadow-sm p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      Custo total por embarcação
                    </p>
                    <p className="text-xs text-blue-500 mt-0.5">{periodDef.label} · {ano}</p>
                  </div>
                  <ViewToggle view={viewLinha} onChange={setViewLinha} />
                </div>
                {loadingPeriodo ? (
                  <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
                ) : chassiPeriodoData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                    Nenhum dado no período selecionado
                  </div>
                ) : viewLinha === 'chart' ? (
                  <CustoChart data={chassiPeriodoData} />
                ) : (
                  <CustoGrid data={chassiPeriodoData} />
                )}
              </div>
              {/* Direita — Gantt */}
              <TLCGantt
                rows={ganttData}
                months={periodMonths}
                ano={ano}
                periodLabel={`${selectedLinha} — ${periodDef.label}`}
                loading={loadingPeriodo}
              />
            </div>
          </div>
        );
      })()}

      {/* Modo Por Mês — Gráfico 1 por linha de produto */}
      {viewMode === 'mes' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <p className="text-sm font-bold text-slate-700">
              Custo por linha de produto{modelo !== 'Todos' ? ` — ${modelo}` : ''}
            </p>
            <div className="flex items-center gap-3">
              {viewLinha === 'chart' && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Zap className="h-3 w-3 text-blue-400" />
                  clique numa barra para detalhar por embarcação
                </span>
              )}
              <ViewToggle view={viewLinha} onChange={setViewLinha} />
            </div>
          </div>

          {loading ? (
            <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
          ) : linhaData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">
              Nenhum dado disponível para o período selecionado
            </div>
          ) : viewLinha === 'chart' ? (
            <CustoChart
              data={linhaData}
              selectedLabel={selectedLinha}
              onBarClick={setSelectedLinha}
            />
          ) : (
            <CustoGrid
              data={linhaData}
              selectedLabel={selectedLinha}
              onRowClick={setSelectedLinha}
            />
          )}
        </div>
      )}

      {/* Gráfico 2 — drill-down por embarcação (só no modo Por Mês) */}
      {viewMode === 'mes' && <div className={cn(
        'rounded-xl border bg-white shadow-sm p-5 transition-all duration-300',
        selectedLinha ? 'border-blue-200' : 'border-gray-200 opacity-50',
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-slate-700">Detalhe por embarcação</p>
            {selectedLinha && (
              <span className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
                {selectedLinha}
                <button
                  onClick={() => setSelectedLinha(null)}
                  className="ml-0.5 rounded-full hover:bg-blue-100 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!selectedLinha && (
              <span className="text-xs text-gray-400 italic">
                Selecione uma linha no gráfico acima
              </span>
            )}
            {selectedLinha && (
              <ViewToggle view={viewDetalhe} onChange={setViewDetalhe} />
            )}
          </div>
        </div>

        {!selectedLinha ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Zap className="h-8 w-8 text-gray-200 mx-auto" />
              <p className="text-sm text-gray-300">Clique em uma linha de produto para ver o detalhe por embarcação</p>
            </div>
          </div>
        ) : chassiDetalheData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400">
            Nenhum chassi encontrado para esta linha
          </div>
        ) : viewDetalhe === 'chart' ? (
          <CustoChart data={chassiDetalheData} />
        ) : (
          <CustoGrid data={chassiDetalheData} />
        )}
      </div>}

    </div>
  );
}
