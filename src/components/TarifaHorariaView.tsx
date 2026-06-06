import { useEffect, useMemo, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { custosPorCategoria, comentarios } from '@/data/mockTarifaHoraria';
import type { TarifaLinha } from '@/data/mockTarifaHoraria';
import {
  getHorasPorLinha, getChassisDrillDown,
  getPayrollPorMes, getPayrollDrillDown,
  getOverheadPorMes, getOverheadDrillDown,
  getSgaPorMes, getSgaDrillDown,
} from '@/services/tarifaHorariaService';
import type { DrillItem } from '@/services/tarifaHorariaService';

const MESES_LABEL = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MESES_PT    = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_KEYS    = ['m01','m02','m03','m04','m05','m06','m07','m08','m09','m10','m11','m12'] as const;

function fmtNum(v: number, d = 2) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function PctCell({ pct, positiveIsGood }: { pct: number | null; positiveIsGood?: boolean }) {
  if (pct === null) return <td className="px-2 py-1.5 text-right text-gray-400 text-xs">—</td>;
  const good = positiveIsGood ? pct > 0 : pct < 0;
  const bad  = positiveIsGood ? pct < 0 : pct > 0;
  const cls  = good ? 'text-green-600' : bad ? 'text-red-600' : 'text-gray-500';
  return <td className={`px-2 py-1.5 text-right font-semibold text-xs ${cls}`}>{pct > 0 ? '+' : ''}{pct}%</td>;
}
function TrendIcon({ trend }: { trend?: 'up' | 'down' | null }) {
  if (!trend) return null;
  return trend === 'up'
    ? <span className="text-green-500 text-[10px] mr-0.5">▲</span>
    : <span className="text-red-500 text-[10px] mr-0.5">▼</span>;
}
function SkeletonRows({ count = 7, cols = 10 }: { count?: number; cols?: number }) {
  return <>
    {Array.from({ length: count }).map((_, i) => (
      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
        {Array.from({ length: cols }).map((__, j) => (
          <td key={j} className="px-2 py-2">
            <div className="h-3 bg-gray-200 rounded animate-pulse" />
          </td>
        ))}
      </tr>
    ))}
  </>;
}

// ── Modal genérico de drill-down ──────────────────────────────────────────────

type DrillConfig = {
  title: string;
  subtitle: string;
  labelHeader: string;
  valueHeader: string;
  valueUnit?: string;        // ex: 'HH' ou 'R$'
  decimals?: number;
  fetch: () => Promise<DrillItem[]>;
};

function DrillDownModal({ config, onClose }: { config: DrillConfig; onClose: () => void }) {
  const [rows, setRows]       = useState<DrillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    config.fetch()
      .then(setRows)
      .catch(() => setErro('Falha ao carregar detalhe.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = rows.reduce((s, r) => s + r.value, 0);
  const dec   = config.decimals ?? 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-700 text-white">
          <div>
            <p className="text-sm font-bold">{config.title}</p>
            <p className="text-xs text-slate-300 mt-0.5">{config.subtitle}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : erro ? (
            <div className="p-5"><p className="text-sm text-red-600">{erro}</p></div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Nenhum registro encontrado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{config.labelHeader}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {config.valueHeader}{config.valueUnit ? ` (${config.valueUnit})` : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-2.5 text-xs text-gray-800">{r.label}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-gray-700 text-xs">{fmtNum(r.value, dec)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr>
                  <td className="px-5 py-2.5 text-xs font-bold text-slate-700">Total — {rows.length} registros</td>
                  <td className="px-5 py-2.5 text-right text-xs font-bold text-slate-700 tabular-nums">{fmtNum(total, dec)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tabela ────────────────────────────────────────────────────────────────────

type TableProps = {
  title: string;
  rows: TarifaLinha[];
  decimals?: number;
  anoAtual: number;
  anoAnt: number;
  mes: number;
  loading?: boolean;
  clickableLinhas?: Set<string>;
  onCellClick?: (linha: string, mesIdx: number) => void;
  positiveIsGood?: boolean;
};

function TarifaTable({ title, rows, decimals = 2, anoAtual, anoAnt, mes, loading, clickableLinhas, onCellClick, positiveIsGood }: TableProps) {
  const mesLabel    = MESES_PT[mes] ?? '';
  const ytdAntLabel = `${mesLabel}'${String(anoAnt).slice(2)} YTD`;
  const ytdAtuLabel = `${mesLabel}'${String(anoAtual).slice(2)} YTD`;
  const colMeses    = MESES_LABEL.slice(0, mes);

  return (
    <div className="overflow-x-auto">
      <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">{title}</div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-700 text-white">
            <th className="px-2 py-2 text-left font-semibold rounded-tl-md min-w-[120px]">Linha</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">{anoAnt} FY</th>
            {colMeses.map(m => (
              <th key={m} className="px-2 py-2 text-right font-semibold">{m}</th>
            ))}
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">{ytdAntLabel}</th>
            <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">{ytdAtuLabel}</th>
            <th className="px-2 py-2 text-right font-semibold rounded-tr-md">%</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? <SkeletonRows count={7} cols={3 + mes} />
            : rows.map((r, i) => {
                const isClickable = !!onCellClick && (!clickableLinhas || clickableLinhas.has(r.linha)) && !r.isBold;
                return (
                  <tr key={r.linha} className={r.isBold ? 'bg-slate-100 border-t-2 border-slate-300 font-bold' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-2 py-1.5 text-gray-800">{r.linha}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{fmtNum(r.fyAnt, decimals)}</td>
                    {colMeses.map((_, idx) => {
                      const key = MES_KEYS[idx];
                      return (
                        <td
                          key={key}
                          onClick={isClickable ? () => onCellClick!(r.linha, idx + 1) : undefined}
                          className={`px-2 py-1.5 text-right text-gray-700 ${isClickable ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-700 group relative transition-colors' : ''}`}
                        >
                          <span className="inline-flex items-center gap-0.5 justify-end">
                            {fmtNum(r[key] as number, decimals)}
                            {isClickable && <ChevronDown className="h-2.5 w-2.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right text-gray-600">
                      <span className="inline-flex items-center justify-end">
                        <TrendIcon trend={r.trend} />{fmtNum(r.ytdAnt, decimals)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-600">
                      <span className="inline-flex items-center justify-end">
                        <TrendIcon trend={r.trend} />{fmtNum(r.ytdAtu, decimals)}
                      </span>
                    </td>
                    <PctCell pct={r.pct} positiveIsGood={positiveIsGood} />
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}

// ── Helpers de cálculo ────────────────────────────────────────────────────────

function calcCustosTotal(rows: TarifaLinha[]): TarifaLinha {
  const s = (k: keyof TarifaLinha) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const ytdAnt = s('ytdAnt'), ytdAtu = s('ytdAtu');
  return {
    linha: 'Total', isBold: true,
    fyAnt: s('fyAnt'),
    m01:s('m01'), m02:s('m02'), m03:s('m03'), m04:s('m04'),
    m05:s('m05'), m06:s('m06'), m07:s('m07'), m08:s('m08'),
    m09:s('m09'), m10:s('m10'), m11:s('m11'), m12:s('m12'),
    ytdAnt, ytdAtu,
    pct: ytdAnt !== 0 ? Math.round((ytdAtu / ytdAnt - 1) * 100) : null,
  };
}

const MES_ANT_KEYS = [
  'm01Ant','m02Ant','m03Ant','m04Ant','m05Ant','m06Ant',
  'm07Ant','m08Ant','m09Ant','m10Ant','m11Ant','m12Ant',
] as const;
type MesAntKey = typeof MES_ANT_KEYS[number];

function buildTarifaRow(custo: TarifaLinha | null, horas: TarifaLinha, label: string): TarifaLinha {
  const d = (c: number, h: number) => h !== 0 ? c / h : 0;
  const c = custo ?? {} as TarifaLinha;
  const ytdAnt = d(c.ytdAnt ?? 0, horas.ytdAnt);
  const ytdAtu = d(c.ytdAtu ?? 0, horas.ytdAtu);
  const antFields = Object.fromEntries(
    MES_ANT_KEYS.map(k => [k, d(c[k] ?? 0, horas[k] ?? 0)])
  ) as Record<MesAntKey, number>;
  return {
    linha: label,
    fyAnt: d(c.fyAnt ?? 0, horas.fyAnt),
    m01: d(c.m01 ?? 0, horas.m01), m02: d(c.m02 ?? 0, horas.m02),
    m03: d(c.m03 ?? 0, horas.m03), m04: d(c.m04 ?? 0, horas.m04),
    m05: d(c.m05 ?? 0, horas.m05), m06: d(c.m06 ?? 0, horas.m06),
    m07: d(c.m07 ?? 0, horas.m07), m08: d(c.m08 ?? 0, horas.m08),
    m09: d(c.m09 ?? 0, horas.m09), m10: d(c.m10 ?? 0, horas.m10),
    m11: d(c.m11 ?? 0, horas.m11), m12: d(c.m12 ?? 0, horas.m12),
    ytdAnt, ytdAtu,
    pct: ytdAnt !== 0 ? Math.round((ytdAtu / ytdAnt - 1) * 100) : null,
    ...antFields,
  };
}

// ── View principal ────────────────────────────────────────────────────────────

type Props = { mes: number; ano: number };

export function TarifaHorariaView({ mes, ano }: Props) {
  const [horasRows, setHorasRows]     = useState<TarifaLinha[]>([]);
  const [loadingHoras, setLoadHoras]  = useState(false);
  const [erroHoras, setErroHoras]     = useState<string | null>(null);

  const [payrollRow, setPayrollRow]   = useState<TarifaLinha | null>(null);
  const [overheadRow, setOverheadRow] = useState<TarifaLinha | null>(null);
  const [sgaRow, setSgaRow]           = useState<TarifaLinha | null>(null);
  const [loadingPay, setLoadPay]      = useState(false);

  const [drillConfig, setDrillConfig] = useState<DrillConfig | null>(null);

  // Carrega Horas por Linha
  useEffect(() => {
    setLoadHoras(true); setErroHoras(null);
    getHorasPorLinha(mes, ano)
      .then(setHorasRows)
      .catch(() => setErroHoras('Falha ao carregar Horas por Linha.'))
      .finally(() => setLoadHoras(false));
  }, [mes, ano]);

  // Carrega Payroll + Overhead + SG&A em paralelo
  useEffect(() => {
    setLoadPay(true);
    Promise.allSettled([
      getPayrollPorMes(mes, ano),
      getOverheadPorMes(mes, ano),
      getSgaPorMes(mes, ano),
    ]).then(([pay, ovh, sga]) => {
      if (pay.status === 'fulfilled') setPayrollRow(pay.value);
      if (ovh.status === 'fulfilled') setOverheadRow(ovh.value);
      if (sga.status === 'fulfilled') setSgaRow(sga.value);
    }).finally(() => setLoadPay(false));
  }, [mes, ano]);

  // Mescla linhas reais com demais categorias mock; recalcula Total
  const custosRows = useMemo(() => {
    const zero = (linha: string): TarifaLinha => ({
      linha, fyAnt: 0,
      m01: 0, m02: 0, m03: 0, m04: 0, m05: 0, m06: 0,
      m07: 0, m08: 0, m09: 0, m10: 0, m11: 0, m12: 0,
      ytdAnt: 0, ytdAtu: 0, pct: null,
    });
    const substituir: Record<string, TarifaLinha | null> = {
      Payroll:        payrollRow,
      Overhead:       overheadRow,
      'SG&A':         sgaRow,
      'Kanban (BOM)': zero('Kanban (BOM)'),
      Resin:          zero('Resin'),
    };
    const linhas = custosPorCategoria
      .filter(r => r.linha !== 'Total')
      .map(r => substituir[r.linha] ?? r);
    return [...linhas, calcCustosTotal(linhas)];
  }, [payrollRow, overheadRow, sgaRow]);

  // Tarifa = custo / horas Grand Total (calculado localmente, sem nova chamada)
  const tarifaRows = useMemo(() => {
    const grandTotal = horasRows.find(r => r.isBold);
    if (!grandTotal) return [];
    const linhas = [
      buildTarifaRow(payrollRow,  grandTotal, 'Payroll'),
      buildTarifaRow(overheadRow, grandTotal, 'Overhead'),
      buildTarifaRow(sgaRow,      grandTotal, 'SG&A'),
    ];
    const s = (k: keyof TarifaLinha) => linhas.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const ytdAnt = s('ytdAnt'), ytdAtu = s('ytdAtu');
    const antTotals = Object.fromEntries(MES_ANT_KEYS.map(k => [k, s(k)])) as Record<MesAntKey, number>;
    const total: TarifaLinha = {
      linha: 'Total', isBold: true,
      fyAnt: s('fyAnt'),
      m01:s('m01'), m02:s('m02'), m03:s('m03'), m04:s('m04'),
      m05:s('m05'), m06:s('m06'), m07:s('m07'), m08:s('m08'),
      m09:s('m09'), m10:s('m10'), m11:s('m11'), m12:s('m12'),
      ytdAnt, ytdAtu,
      pct: ytdAnt !== 0 ? Math.round((ytdAtu / ytdAnt - 1) * 100) : null,
      ...antTotals,
    };
    return [...linhas, total];
  }, [horasRows, payrollRow, overheadRow, sgaRow]);

  // Gráfico: mês selecionado + 5 períodos anteriores
  const tendenciaReal = useMemo(() => {
    const total = tarifaRows.find(r => r.isBold);
    if (!total) return [];
    const anoAntLocal = ano - 1;
    const sufAnt = `'${String(anoAntLocal).slice(2)}`;
    const sufAtu = `'${String(ano).slice(2)}`;
    // todos os 24 meses disponíveis: 12 do ano anterior + 12 do ano atual
    const todos = [
      ...MES_ANT_KEYS.map((k, i) => ({
        label: `${MESES_PT[i + 1]}${sufAnt}`,
        valor: Number(total[k] ?? 0),
      })),
      ...MES_KEYS.map((k, i) => ({
        label: `${MESES_PT[i + 1]}${sufAtu}`,
        valor: total[k] as number,
      })),
    ];
    // posição do mês atual (índice 12 = Jan do ano atual, 12+mes-1 = mês selecionado)
    const idxAtual = 12 + mes - 1;
    return todos.slice(idxAtual - 5, idxAtual + 1);
  }, [tarifaRows, mes, ano]);

  const mesLabel = MESES_PT[mes] ?? '';
  const anoAnt   = ano - 1;

  // Helpers para montar o drill config
  function openHorasDrill(linha: string, mesIdx: number) {
    setDrillConfig({
      title: 'Chassis com apontamento',
      subtitle: `${linha} — ${MESES_PT[mesIdx]}/${ano}`,
      labelHeader: 'Chassis',
      valueHeader: 'HH',
      decimals: 1,
      fetch: () => getChassisDrillDown(linha, mesIdx, ano).then(rows =>
        rows.map(r => ({ label: r.chassi, value: r.hh }))
      ),
    });
  }

  function openCustoDrill(linha: string, mesIdx: number) {
    const fetchMap: Record<string, () => Promise<DrillItem[]>> = {
      Payroll:  () => getPayrollDrillDown(mesIdx, ano),
      Overhead: () => getOverheadDrillDown(mesIdx, ano),
      'SG&A':   () => getSgaDrillDown(mesIdx, ano),
    };
    setDrillConfig({
      title: `${linha} por Conta Contábil`,
      subtitle: `${MESES_PT[mesIdx]}/${ano}`,
      labelHeader: 'Conta',
      valueHeader: 'Valor',
      valueUnit: 'R$',
      decimals: 2,
      fetch: fetchMap[linha] ?? (() => Promise.resolve([])),
    });
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-700 tracking-wide">
            Tarifa Horária ({mesLabel}'{String(ano).slice(2)})
          </h2>
        </div>

        <div className="flex gap-0">
          <div className="flex-1 min-w-0 p-5 space-y-6 border-r border-gray-100 overflow-x-auto">
            {erroHoras && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{erroHoras}</div>
            )}

            <TarifaTable
              title="Horas por Linha"
              rows={horasRows}
              decimals={2}
              anoAtual={ano} anoAnt={anoAnt} mes={mes}
              loading={loadingHoras}
              onCellClick={openHorasDrill}
              positiveIsGood
            />

            <TarifaTable
              title="Custos (R$)"
              rows={custosRows}
              decimals={2}
              anoAtual={ano} anoAnt={anoAnt} mes={mes}
              loading={loadingPay}
              clickableLinhas={new Set(['Payroll', 'Overhead', 'SG&A'])}
              onCellClick={(linha, mesIdx) => openCustoDrill(linha, mesIdx)}
            />

            <TarifaTable
              title="Tarifa Horária (R$/h)"
              rows={tarifaRows}
              decimals={2}
              anoAtual={ano} anoAnt={anoAnt} mes={mes}
              loading={loadingHoras || loadingPay}
            />
          </div>

          <div className="w-60 shrink-0 p-4 space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-600 mb-2">Tarifa Horária</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={tendenciaReal} margin={{ top: 4, right: 4, left: -12, bottom: 4 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(v: number) => [`R$ ${fmtNum(v, 2)}/h`, 'Tarifa']}
                  />
                  <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
                    {tendenciaReal.map((_, i) => (
                      <Cell key={i} fill={i === tendenciaReal.length - 1 ? '#1e3a5f' : '#4a7ab5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {comentarios.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] text-gray-700 leading-relaxed">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {drillConfig && (
        <DrillDownModal config={drillConfig} onClose={() => setDrillConfig(null)} />
      )}
    </>
  );
}
