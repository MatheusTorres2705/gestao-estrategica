import { useEffect, useMemo, useState } from 'react';
import { useParams, useOutletContext, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, Plus, TrendingUp, TrendingDown, Minus,
  Target, ShieldCheck, Award, DollarSign, Factory, Layers, Package, BarChart3,
} from 'lucide-react';
import { TrendChart } from '@/components/TrendChart';
import { getIndicadorDetalhe } from '@/services/indicadoresService';
import { getCausas } from '@/services/causasService';
import type { Indicador, Causa } from '@/types';
import { calcPctAtingimento, statusBscFromPct } from '@/types';
import { fmtPeriodo } from '@/lib/formatters';
import { CausaEfeitoModal } from '@/pages/CausaEfeitoModal';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { obterReg } from '@/lib/obterReg';
import { cn } from '@/lib/utils';

type OutletCtx = { mes: number; ano: number };

const ICONS: Record<string, React.ElementType> = {
  ShieldCheck, Award, DollarSign, Factory, Layers, Package, BarChart3,
};

const CATEGORIA_LABELS: Record<string, string> = {
  '6M-maquina': 'Máquina',
  '6M-mao-de-obra': 'Mão de Obra',
  '6M-metodo': 'Método',
  '6M-material': 'Material',
  '6M-meio-ambiente': 'Meio Ambiente',
  '6M-medicao': 'Medição',
};

const STATUS_BSC_CFG = {
  'no-prazo': { label: 'No Prazo', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'atencao':  { label: 'Atenção',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'critico':  { label: 'Crítico',  cls: 'bg-red-50 text-red-700 border border-red-200' },
};

export default function IndicadorPage() {
  const { id } = useParams<{ id: string }>();
  const { mes, ano } = useOutletContext<OutletCtx>();
  const nav = useNavigate();
  const [indicador, setIndicador] = useState<Indicador | undefined>();
  const [causas, setCausas] = useState<Causa[]>([]);
  const [showCausaModal, setShowCausaModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    getIndicadorDetalhe(id, mes, ano).then(setIndicador);
    getCausas(id).then(setCausas);
  }, [id, mes, ano]);

  if (!indicador) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const Icon = ICONS[indicador.icone] ?? BarChart3;

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/dashboard" className="hover:text-gray-600 transition-colors">Metas e Indicadores</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{indicador.nome}</span>
      </div>

      {/* Hero Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => nav('/dashboard')}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{indicador.nome}</h1>
          <p className="text-sm text-gray-500">{fmtPeriodo(mes, ano)}</p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {indicador.metricas.map((m) => {
          const isNum = typeof m.valor === 'number' && typeof m.meta === 'number';
          const pct = isNum
            ? calcPctAtingimento(m.valor as number, m.meta as number, m.polaridade ?? 'maior')
            : null;
          const statusKey = pct !== null ? statusBscFromPct(pct) : null;
          const statusCfg = statusKey ? STATUS_BSC_CFG[statusKey] : null;

          const diff = isNum ? (m.valor as number) - (m.meta as number) : null;
          return (
            <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-medium leading-tight">{m.label}</p>
                {statusCfg && (
                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium border', statusCfg.cls)}>
                    {statusCfg.label}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {typeof m.valor === 'number' ? m.valor.toLocaleString('pt-BR') : m.valor}
                {m.unidade === '%' && <span className="text-base text-gray-400">%</span>}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-gray-400">
                  <Target className="inline h-3 w-3 mr-1 text-gray-300" />
                  Meta: {typeof m.meta === 'number' ? m.meta.toLocaleString('pt-BR') : m.meta}
                  {m.unidade === '%' ? '%' : m.unidade ? ` ${m.unidade}` : ''}
                </p>
                {diff !== null && (
                  <span className={cn('flex items-center gap-0.5 text-xs font-medium',
                    diff === 0 ? 'text-gray-400' : statusKey === 'no-prazo' ? 'text-emerald-600' : statusKey === 'atencao' ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {diff === 0 ? <Minus className="h-3 w-3" /> : diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(diff).toLocaleString('pt-BR')}{m.unidade === '%' ? 'p.p.' : m.unidade ? ` ${m.unidade}` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráfico de tendência */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolução — Últimos 6 Meses</h3>
        <TrendChart
          data={indicador.tendencia}
          height={220}
          unit={indicador.metricas[0]?.unidade === '%' ? '%' : ''}
        />
      </div>

      {/* Conteúdo específico por indicador */}
      {indicador.id === 'qualidade' && indicador.detalheExtra && <QualidadeDetalhe detalhe={indicador.detalheExtra} />}
      {indicador.id === 'tarifa-horaria' && indicador.detalheExtra && <TarifaDetalhe detalhe={indicador.detalheExtra} />}
      {indicador.id === 'working-capital' && indicador.subIndicadores && <WorkingCapitalDetalhe subIndicadores={indicador.subIndicadores} />}
      {indicador.id === 'seguranca' && indicador.detalheExtra && <SegurancaDetalhe detalhe={indicador.detalheExtra} />}
      {indicador.id === 'moldes' && indicador.detalheExtra && <MoldesDetalhe detalhe={indicador.detalheExtra} />}
      {indicador.id === 'pcm' && indicador.detalheExtra && <PcmDetalhe detalhe={indicador.detalheExtra} />}
      {indicador.id === 'producao' && <ProducaoDetalhe mes={mes} ano={ano} />}

      {/* Causas */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Análise de Causa e Efeito</h3>
            <p className="text-xs text-gray-500 mt-0.5">{causas.length} análise(s)</p>
          </div>
          <Button size="sm" onClick={() => setShowCausaModal(true)}>
            <Plus className="h-3.5 w-3.5" /> Nova Análise
          </Button>
        </div>

        {causas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
            <p className="text-gray-400 text-sm">Nenhuma análise registrada ainda.</p>
            <button onClick={() => setShowCausaModal(true)} className="mt-2 text-sm text-blue-600 hover:underline">
              Criar primeira análise
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {causas.map((causa) => (
              <div key={causa.id} className="flex items-start gap-4 rounded-xl border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
                <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">{CATEGORIA_LABELS[causa.categoria]?.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{causa.problema}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{CATEGORIA_LABELS[causa.categoria]} — {causa.responsavel}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{causa.dataCriacao}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{causa.descricao}</p>
                  {causa.planosCount > 0 && (
                    <p className="text-xs text-blue-600 mt-2">{causa.planosCount} plano(s) vinculado(s)</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCausaModal && (
        <CausaEfeitoModal
          indicadorId={indicador.id}
          indicadorNome={indicador.nome}
          onClose={() => setShowCausaModal(false)}
          onSaved={(nova) => { setCausas((p) => [...p, nova]); setShowCausaModal(false); }}
        />
      )}
    </div>
  );
}

// Sub-componentes de detalhe (adaptados para tema light)

function QualidadeDetalhe({ detalhe }: { detalhe: Record<string, unknown> }) {
  const gates = detalhe.gates as Array<{ gate: string; resultado: number; meta: number }> ?? [];
  const defeitosPorArea = detalhe.defeitosPorArea as Array<{ area: string; quantidade: number; percentual: number }> ?? [];
  const topProblemas = detalhe.topProblemasCampo as Array<{ rank: number; problema: string; ocorrencias: number; acao: string }> ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolução dos Gates</h3>
        <div className="space-y-3">
          {gates.map((g) => (
            <div key={g.gate}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">{g.gate}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Meta: {g.meta}%</span>
                  <span className={`text-xs font-semibold ${g.resultado >= g.meta ? 'text-emerald-600' : 'text-red-600'}`}>{g.resultado}%</span>
                </div>
              </div>
              <div className="relative h-2 rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${g.resultado >= g.meta ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${g.resultado}%` }} />
                <div className="absolute top-0 h-full w-0.5 bg-gray-400/50" style={{ left: `${g.meta}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Defeitos por Área</h3>
        <div className="space-y-2">
          {defeitosPorArea.map((d) => (
            <div key={d.area} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24 shrink-0">{d.area}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${d.percentual}%` }} /></div>
              <span className="text-xs font-medium text-gray-700 w-8 text-right">{d.quantidade}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">TOP 5 — Problemas Pós-Venda</h3>
        <div className="space-y-3">
          {topProblemas.map((p) => (
            <div key={p.rank} className="flex gap-4 rounded-lg border border-gray-100 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">{p.rank}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">{p.problema}</p>
                  <span className="text-xs text-gray-500">{p.ocorrencias} oc.</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Ação: {p.acao}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TarifaDetalhe({ detalhe }: { detalhe: Record<string, unknown> }) {
  const melhorias = detalhe.topMelhorias as Array<{ setor: string; variacao: number; motivo: string }> ?? [];
  const pioras = detalhe.topPioras as Array<{ setor: string; variacao: number; motivo: string }> ?? [];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <h3 className="text-sm font-semibold text-emerald-700 mb-4">Top 3 Melhorias vs Março</h3>
        <div className="space-y-3">
          {melhorias.map((m, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">{i + 1}</span>
              <div>
                <div className="flex items-center gap-2"><p className="text-sm font-medium text-gray-800">{m.setor}</p><span className="text-xs font-semibold text-emerald-600">{m.variacao.toFixed(1)}%</span></div>
                <p className="text-xs text-gray-500">{m.motivo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h3 className="text-sm font-semibold text-red-700 mb-4">Top 3 Pioras vs Março</h3>
        <div className="space-y-3">
          {pioras.map((p, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">{i + 1}</span>
              <div>
                <div className="flex items-center gap-2"><p className="text-sm font-medium text-gray-800">{p.setor}</p><span className="text-xs font-semibold text-red-600">+{p.variacao.toFixed(1)}%</span></div>
                <p className="text-xs text-gray-500">{p.motivo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkingCapitalDetalhe({ subIndicadores }: { subIndicadores: Array<{ label: string; valor: number | string; unidade?: string; cor?: string }> }) {
  const data = subIndicadores.map((s) => ({ name: s.label, value: typeof s.valor === 'number' ? s.valor : 0, color: s.cor ?? '#2563EB' }));
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Composição do Estoque</h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="h-52 w-52 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {data.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}%`]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 w-full space-y-2">
          {subIndicadores.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ background: s.cor }} />
              <span className="text-xs text-gray-600 flex-1">{s.label}</span>
              <span className="text-sm font-semibold text-gray-800">{s.valor}{s.unidade}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SegurancaDetalhe({ detalhe }: { detalhe: Record<string, unknown> }) {
  const acidentes = detalhe.acidentes as Array<{ data: string; descricao: string; gravidade: string; afastamento: string }> ?? [];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Detalhamento de Acidentes/Incidentes</h3>
      <div className="space-y-3">
        {acidentes.map((a, i) => (
          <div key={i} className="flex gap-4 rounded-lg border border-gray-100 p-3.5">
            <p className="text-xs font-bold text-gray-500 shrink-0">{a.data}</p>
            <div className="flex-1">
              <p className="text-sm text-gray-800">{a.descricao}</p>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-gray-500">Gravidade: <span className="text-amber-600">{a.gravidade}</span></span>
                <span className="text-xs text-gray-500">Afastamento: <span className={a.afastamento !== 'Não' ? 'text-red-600' : 'text-emerald-600'}>{a.afastamento}</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoldesDetalhe({ detalhe }: { detalhe: Record<string, unknown> }) {
  const atividades = detalhe.atividadesRealizadas as string[] ?? [];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Atividades Realizadas</h3>
      <ul className="space-y-2">
        {atividades.map((a, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />{a}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PcmDetalhe({ detalhe }: { detalhe: Record<string, unknown> }) {
  const faltantes = detalhe.faltantesCriticos as Array<{ codigo: string; descricao: string; quantidade: number; prevEntrega: string; acao: string }> ?? [];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Itens Críticos Faltantes — Maio</h3>
      <div className="space-y-3">
        {faltantes.map((f) => (
          <div key={f.codigo} className="rounded-lg border border-red-100 bg-red-50 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-mono text-red-600">{f.codigo}</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{f.descricao}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">Qtd: <span className="text-gray-800 font-medium">{f.quantidade}</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Prev: <span className="text-amber-600">{f.prevEntrega}</span></p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Ação: {f.acao}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Produção: OPE por Galpão ─────────────────────────────── */

const _LINHAS_MAIORES = new Set(['NX260','NX270','NX280','NX290','NX310','NX340','NX350','NX360','NX370']);
const _LINHAS_GALP2   = new Set(['NX410','NX440']);
const _LINHAS_GALP3   = new Set(['NX500','NX620']);
const _LINHAS_MAIORES_ARR = ['NX260','NX270','NX280','NX290','NX310','NX340','NX350','NX360','NX370'];
const _LINHAS_MENORES_ARR = ['NX410','NX440','NX500','NX620','NX62'];
const _SETORES_SQL = ['ACAB','MONT','MARC','ELET','LAM','REB'];
const _OPE_META_PCT = 85;

type _RawAtivRow  = { linha: string; data: string; setorMacro: string; horas: number; qtdAtiv: number };
type _RawPontoRow = { linha: string; data: string; setorMacro: string; qtdPonto: number; horasPonto: number };
type _AggRow      = { label: string; horas: number; horasReg: number; qtdAtiv: number; qtdPonto: number };
type _KpiStatus   = 'ok' | 'atencao' | 'critico';

function _oracleInicio(s: string) { return `TO_DATE('${s} 00:00:00', 'DD/MM/YYYY HH24:MI:SS')`; }
function _oracleFim(s: string)    { return `TO_DATE('${s} 23:59:59', 'DD/MM/YYYY HH24:MI:SS')`; }
function _oracleData(s: string)   { return `TO_DATE('${s}', 'DD/MM/YYYY')`; }

function _buildSqlAtividades(ini: string, fim: string, linhasArr: string[], setor: string): string {
  const linhasIn = linhasArr.map(l => `'${l}'`).join(',');
  return `
WITH
TAB_APO AS (
  SELECT APO.*
  FROM AD_CRONOGRAMA CRO
    LEFT JOIN AD_DETALCRONOGRAMA DET ON DET.SEQ = CRO.SEQ
    LEFT JOIN AD_APOAVANCO APO ON (APO.SEQ = DET.SEQ AND APO.CODUSU = DET.CODUSU)
    LEFT JOIN TGFPRO PRO ON APO.CODPRODSP = PRO.CODPROD
    INNER JOIN TCSPRJ PRJ ON PRJ.CODPROJ = CRO.CODPROJ
    INNER JOIN TSIUSU USU ON USU.CODUSU = APO.CODUSU
  WHERE APO.DATA BETWEEN ${_oracleInicio(ini)} AND ${_oracleFim(fim)}
    AND SUBSTR(PRJ.IDENTIFICACAO, 1, 5) IN (${linhasIn})
),
TAB_DEP AS (
  SELECT DISTINCT
    DEP.AD_CODUSU, DEP.CODDEP, DEP.DESCRDEP, DEPL.CODPROJPAI
  FROM TFPDEP DEP
    LEFT JOIN AD_DEPLINHA DEPL ON DEPL.CODDEP = DEP.CODDEP
  WHERE DEP.AD_CODUSU IS NOT NULL
),
TAB_BASE AS (
  SELECT
    COMP.SEQ                        AS COD_SEQUENCIAL,
    PRJ.CODPROJPAI,
    TAB_DEP.CODDEP,
    TAB_DEP.DESCRDEP,
    SUBSTR(PRJ.IDENTIFICACAO, 1, 5) AS LINHA,
    PRJ.IDENTIFICACAO               AS CHASSI,
    COMP.CODUSU                     AS COD_SETOR,
    USU.NOMEUSU                     AS SETOR,
    COMP.CODPRODSP                  AS COD_ATIVIDADE,
    PRO.DESCRPROD                   AS ATIVIDADE,
    COMP.QTD                        AS DURACAO,
    COMP.FEITO                      AS STATUS,
    APO.DATA                        AS DATA_EXECUCAO,
    ROW_NUMBER() OVER (
      PARTITION BY
        COMP.SEQ, PRJ.CODPROJPAI, SUBSTR(PRJ.IDENTIFICACAO, 1, 5), PRJ.IDENTIFICACAO,
        COMP.CODUSU, USU.NOMEUSU, COMP.CODPRODSP, PRO.DESCRPROD, COMP.QTD, COMP.FEITO, APO.DATA
      ORDER BY
        (SELECT COUNT(*) FROM AD_DEPLINHA X WHERE X.CODDEP = TAB_DEP.CODDEP) ASC,
        TAB_DEP.CODDEP ASC
    ) AS RN
  FROM AD_COMPONENTECRONO COMP
    LEFT JOIN TAB_APO APO
      ON APO.SEQ = COMP.SEQ AND APO.CODUSU = COMP.CODUSU AND APO.CODPRODSP = COMP.CODPRODSP
    LEFT JOIN TGFPRO PRO        ON PRO.CODPROD  = COMP.CODPRODSP
    LEFT JOIN TSIUSU USU        ON USU.CODUSU   = COMP.CODUSU
    LEFT JOIN AD_CRONOGRAMA CRO ON CRO.SEQ      = COMP.SEQ
    LEFT JOIN TCSPRJ PRJ        ON PRJ.CODPROJ  = CRO.CODPROJ
    LEFT JOIN TAB_DEP
      ON TAB_DEP.AD_CODUSU  = COMP.CODUSU
     AND TAB_DEP.CODPROJPAI = PRJ.CODPROJPAI
  WHERE COMP.RETRABALHO IS NULL
    AND APO.DATA IS NOT NULL
),
SETOR_MACRO AS (
  SELECT DISTINCT DEP.AD_CODUSU, DEPL.SETORMACRO
  FROM TFPDEP DEP
    JOIN AD_DEPLINHA DEPL ON DEPL.CODDEP = DEP.CODDEP
  WHERE DEP.AD_CODUSU IS NOT NULL
    AND DEPL.SETORMACRO IS NOT NULL
)
SELECT
  TB.LINHA,
  TO_CHAR(TB.DATA_EXECUCAO, 'DD/MM/YYYY') AS DATA,
  SM.SETORMACRO,
  COUNT(*)                        AS QTD_REGISTROS,
  ROUND(SUM(TB.DURACAO) / 60, 2) AS HORAS
FROM TAB_BASE TB
  JOIN SETOR_MACRO SM ON SM.AD_CODUSU = TB.COD_SETOR
WHERE TB.RN = 1
  AND SM.SETORMACRO = '${setor}'
GROUP BY TB.LINHA, TB.DATA_EXECUCAO, SM.SETORMACRO
ORDER BY TB.LINHA, TB.DATA_EXECUCAO, SM.SETORMACRO
`.trim();
}

function _buildSqlPonto(ini: string, fim: string, linhasArr: string[], setor: string): string {
  const linhasIn = linhasArr.map(l => `'${l}'`).join(',');
  return `
SELECT LINHA, DATA, SETORMACRO,
  COUNT(*)      AS QTD_REGISTROS,
  COUNT(*) * 8  AS HORAS_PONTO
FROM (
  SELECT DISTINCT
    PON.CODFUNC,
    TO_CHAR(PON.DTPONTO, 'DD/MM/YYYY') AS DATA,
    'NX' || CASE SUBSTR(DEPL.CODPROJPAI, 3, 3)
                 WHEN '480' THEN '500'
                 ELSE SUBSTR(DEPL.CODPROJPAI, 3, 3)
            END  AS LINHA,
    DEPL.SETORMACRO
  FROM AD_BATPONTO PON
    JOIN TFPEQP EQ        ON EQ.CODEQP   = PON.CODEQP
    JOIN TFPFUN FUN       ON FUN.CODFUNC = PON.CODFUNC
    JOIN AD_DEPLINHA DEPL ON DEPL.CODDEP = FUN.CODDEP
  WHERE PON.DTPONTO BETWEEN ${_oracleData(ini)} AND ${_oracleData(fim)}
    AND EQ.AD_USADO     = '1'
    AND DEPL.SETORMACRO = '${setor}'
    AND DEPL.CODPROJPAI IS NOT NULL
)
WHERE LINHA IN (${linhasIn})
GROUP BY LINHA, DATA, SETORMACRO
ORDER BY LINHA, DATA, SETORMACRO
`.trim();
}

// Sankhya pode retornar array [LINHA, DATA, SETORMACRO, QTD_REGISTROS, HORAS]
// ou objeto com chaves nomeadas — ambos são suportados
function _mapAtiv(r: unknown): _RawAtivRow {
  if (Array.isArray(r)) {
    return { linha: String(r[0] ?? ''), data: String(r[1] ?? ''), setorMacro: String(r[2] ?? ''), qtdAtiv: Number(r[3] ?? 0), horas: Number(r[4] ?? 0) };
  }
  const o = r as Record<string, unknown>;
  return {
    linha:      String(o['LINHA']         ?? o['linha']         ?? ''),
    data:       String(o['DATA']          ?? o['data']          ?? ''),
    setorMacro: String(o['SETORMACRO']    ?? o['setormacro']    ?? ''),
    horas:      Number(o['HORAS']         ?? o['horas']         ?? 0),
    qtdAtiv:    Number(o['QTD_REGISTROS'] ?? o['qtd_registros'] ?? 0),
  };
}

// Sankhya pode retornar array [LINHA, DATA, SETORMACRO, QTD_REGISTROS, HORAS_PONTO]
// ou objeto com chaves nomeadas — ambos são suportados
function _mapPonto(r: unknown): _RawPontoRow {
  if (Array.isArray(r)) {
    return { linha: String(r[0] ?? ''), data: String(r[1] ?? ''), setorMacro: String(r[2] ?? ''), qtdPonto: Number(r[3] ?? 0), horasPonto: Number(r[4] ?? 0) };
  }
  const o = r as Record<string, unknown>;
  return {
    linha:      String(o['LINHA']         ?? o['linha']         ?? ''),
    data:       String(o['DATA']          ?? o['data']          ?? ''),
    setorMacro: String(o['SETORMACRO']    ?? o['setormacro']    ?? ''),
    qtdPonto:   Number(o['QTD_REGISTROS'] ?? o['qtd_registros'] ?? 0),
    horasPonto: Number(o['HORAS_PONTO']   ?? o['horas_ponto']   ?? 0),
  };
}

function _agregarOpe(ativos: _RawAtivRow[], pontos: _RawPontoRow[]): _AggRow[] {
  const grupos = [
    { label: 'Geral',    fn: (_: string) => true },
    { label: 'Galpão 1', fn: (l: string) => _LINHAS_MAIORES.has(l) },
    { label: 'Galpão 2', fn: (l: string) => _LINHAS_GALP2.has(l) },
    { label: 'Galpão 3', fn: (l: string) => _LINHAS_GALP3.has(l) },
  ];
  return grupos.map(({ label, fn }) => ({
    label,
    horas:    ativos.filter(r => fn(r.linha)).reduce((s, r) => s + r.horas,      0),
    horasReg: pontos.filter(r => fn(r.linha)).reduce((s, r) => s + r.horasPonto, 0),
    qtdAtiv:  ativos.filter(r => fn(r.linha)).reduce((s, r) => s + r.qtdAtiv,    0),
    qtdPonto: pontos.filter(r => fn(r.linha)).reduce((s, r) => s + r.qtdPonto,   0),
  }));
}

function _OpeGalpaoCard({ rows, loading = false }: { rows: _AggRow[]; loading?: boolean }) {
  const barColor = (s: _KpiStatus) =>
    s === 'ok' ? 'bg-emerald-500' : s === 'atencao' ? 'bg-amber-400' : 'bg-rose-500';
  const textColor = (s: _KpiStatus) =>
    s === 'ok' ? 'text-emerald-600' : s === 'atencao' ? 'text-amber-600' : 'text-rose-500';
  const statusOpe = (pct: number): _KpiStatus =>
    pct >= _OPE_META_PCT ? 'ok' : pct >= _OPE_META_PCT - 10 ? 'atencao' : 'critico';

  return (
    <div className="w-full rounded-2xl border border-slate-100 bg-white shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">OPE por Galpão</span>
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <span className="opacity-40">◎</span> Meta: {_OPE_META_PCT}%
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-20 h-3 rounded bg-slate-100 animate-pulse" />
              <div className="flex-1 h-5 rounded-full bg-slate-100 animate-pulse" />
              <span className="w-12 h-3 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(row => {
            const pct    = row.horasReg > 0 ? row.horas / row.horasReg * 100 : null;
            const filled = pct !== null ? Math.min(pct, 100) : 0;
            const status = pct !== null ? statusOpe(pct) : 'atencao';
            const valStr = pct !== null ? `${pct.toFixed(1).replace('.', ',')}%` : '—';
            const isGeral = row.label === 'Geral';

            return (
              <div key={row.label} className="flex items-center gap-3">
                <span className={`w-20 shrink-0 text-[11px] text-right ${isGeral ? 'font-bold text-slate-700' : 'font-medium text-slate-500'}`}>
                  {row.label}
                </span>
                <div className="relative flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor(status)}`}
                    style={{ width: `${filled}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-px bg-slate-400/60"
                    style={{ left: `${_OPE_META_PCT}%` }}
                  />
                  <span
                    className={`absolute inset-y-0 flex items-center text-[11px] font-bold tabular-nums transition-all duration-500 ${
                      filled > 15 ? 'text-white right-auto' : `${textColor(status)} left-auto`
                    }`}
                    style={filled > 15 ? { left: `${filled - 2}%`, transform: 'translateX(-100%)' } : { left: `${filled + 2}%` }}
                  >
                    {valStr}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] text-slate-400 w-8 text-right">100%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProducaoDetalhe({ mes, ano }: { mes: number; ano: number }) {
  const now = new Date();

  const periodoIni = useMemo(() =>
    `01/${String(mes).padStart(2, '0')}/${ano}`
  , [mes, ano]);

  const periodoFim = useMemo(() => {
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const isMesAtual = mes === now.getMonth() + 1 && ano === now.getFullYear();
    const ultimoDia  = isMesAtual ? now.getDate() : diasNoMes;
    return `${String(ultimoDia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
  }, [mes, ano]);

  const [dadosAtiv,  setDadosAtiv]  = useState<_RawAtivRow[]>([]);
  const [dadosPonto, setDadosPonto] = useState<_RawPontoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    const queries = [_LINHAS_MAIORES_ARR, _LINHAS_MENORES_ARR].flatMap(linhas =>
      _SETORES_SQL.flatMap(setor => [
        obterReg(_buildSqlAtividades(periodoIni, periodoFim, linhas, setor)),
        obterReg(_buildSqlPonto(periodoIni, periodoFim, linhas, setor)),
      ])
    );
    Promise.all(queries)
      .then(results => {
        const ativos: _RawAtivRow[]  = [];
        const pontos: _RawPontoRow[] = [];
        for (let i = 0; i < results.length; i += 2) {
          results[i].forEach(r => ativos.push(_mapAtiv(r)));
          results[i + 1].forEach(r => pontos.push(_mapPonto(r)));
        }
        setDadosAtiv(ativos);
        setDadosPonto(pontos);
      })
      .catch((e) => setErro(`Falha ao carregar dados de OPE: ${e?.message ?? 'erro desconhecido'}`))
      .finally(() => setLoading(false));
  }, [periodoIni, periodoFim]);

  const ope = useMemo(() => _agregarOpe(dadosAtiv, dadosPonto), [dadosAtiv, dadosPonto]);

  if (erro) {
    return (
      <div className="w-full rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">OPE por Galpão</span>
        <p className="mt-3 text-xs text-rose-500">{erro}</p>
      </div>
    );
  }

  return <_OpeGalpaoCard rows={ope} loading={loading} />;
}
