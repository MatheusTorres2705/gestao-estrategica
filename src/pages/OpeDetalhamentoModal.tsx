import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts';
import { obterReg } from '@/lib/api';

/* ── Helpers de data ───────────────────────────────────────── */
function hoje(): string {
  const d = new Date();
  return [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), d.getFullYear()].join('/');
}
function toInput(ddmmyyyy: string): string {
  if (!ddmmyyyy || ddmmyyyy.length !== 10) return '';
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m}-${d}`;
}
function fromInput(iso: string): string {
  if (!iso || iso.length !== 10) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function primeiroDiaMes(): string {
  const d = new Date();
  return `01/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function oracleInicio(s: string) { return `TO_DATE('${s} 00:00:00', 'DD/MM/YYYY HH24:MI:SS')`; }
function oracleFim(s: string)    { return `TO_DATE('${s} 23:59:59', 'DD/MM/YYYY HH24:MI:SS')`; }
function oracleData(s: string)   { return `TO_DATE('${s}', 'DD/MM/YYYY')`; }

function parseDDMMYYYY(s: string): number {
  const [d, m, y] = s.split('/').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/* ── Grupos de linha ───────────────────────────────────────── */
const LINHAS_MENORES     = new Set(['NX260','NX270','NX280','NX290','NX310','NX340','NX350','NX360','NX370']);
const LINHAS_MAIORES     = new Set(['NX410','NX440','NX500','NX620']);
const LINHAS_GALP2       = new Set(['NX410','NX440']);
const LINHAS_GALP3       = new Set(['NX500','NX620']);

const LINHAS_MAIORES_ARR = ['NX260','NX270','NX280','NX290','NX310','NX340','NX350','NX360','NX370'];
const LINHAS_MENORES_ARR = ['NX410','NX440','NX500','NX620','NX62'];
const SETORES_SQL        = ['ACAB','MONT','MARC','ELET','LAM','REB'];

/* ── Classificação por SETORMACRO ──────────────────────────── */
type DeptKey = 'Acab' | 'Mont' | 'Marc' | 'Ele' | 'Lam' | 'Reb';
const DEPT_KEYS: DeptKey[] = ['Acab','Mont','Marc','Ele','Lam','Reb'];
const DEPT_LABELS: Record<DeptKey, string> = {
  Acab: 'Acabamento', Mont: 'Montagem', Marc: 'Marcenaria',
  Ele: 'Elétrica', Lam: 'Laminação', Reb: 'Rebarba',
};
const SETORMACRO_MAP: Record<string, DeptKey> = {
  ACAB: 'Acab', MONT: 'Mont', MARC: 'Marc', ELET: 'Ele', LAM: 'Lam', REB: 'Reb',
};
function classifyDept(setorMacro: string): DeptKey | null {
  return SETORMACRO_MAP[setorMacro] ?? null;
}

/* ── Tipos de linha bruta ──────────────────────────────────── */
type RawAtivRow  = { linha: string; data: string; setorMacro: string; horas: number; qtdAtiv: number; horasRetrabalho: number; qtdRetrabalho: number };
type RawPontoRow = { linha: string; data: string; setorMacro: string; qtdPonto: number; horasPonto: number };
type DailyPoint  = { data: string; ope: number };
type AggRow      = { label: string; horas: number; horasReg: number; qtdAtiv: number; qtdPonto: number; horasRetrabalho: number; qtdRetrabalho: number };

/* ── Opções de seleção dos gráficos ────────────────────────── */
const OPCOES_SETOR_GRAF = [
  { label: 'Geral', sm: null as string | null },
  { label: 'Acab.',  sm: 'ACAB' },
  { label: 'Mont.',  sm: 'MONT' },
  { label: 'Marc.',  sm: 'MARC' },
  { label: 'Elét.',  sm: 'ELET' },
  { label: 'Lam.',   sm: 'LAM'  },
  { label: 'Reb.',   sm: 'REB'  },
];

const OPCOES_GALP_GRAF = [
  { label: 'Geral',    fn: (_: string) => true },
  { label: 'Galpão 1', fn: (l: string) => LINHAS_MENORES.has(l) },
  { label: 'Galpão 2', fn: (l: string) => LINHAS_GALP2.has(l)   },
  { label: 'Galpão 3', fn: (l: string) => LINHAS_GALP3.has(l)   },
];

const FILTRO_BASE: Record<string, (l: string) => boolean> = {
  maiores: l => LINHAS_MAIORES.has(l),
  menores: l => LINHAS_MENORES.has(l),
  ope:     () => true,
};

/* ── Agregação ─────────────────────────────────────────────── */
function agregar(ativos: RawAtivRow[], pontos: RawPontoRow[], filtroLinha: (l: string) => boolean): AggRow[] {
  const acc: Record<DeptKey, { horas: number; qtdAtiv: number; horasPonto: number; qtdPonto: number; horasRetrabalho: number; qtdRetrabalho: number }> = {
    Acab: {horas:0,qtdAtiv:0,horasPonto:0,qtdPonto:0,horasRetrabalho:0,qtdRetrabalho:0},
    Mont: {horas:0,qtdAtiv:0,horasPonto:0,qtdPonto:0,horasRetrabalho:0,qtdRetrabalho:0},
    Marc: {horas:0,qtdAtiv:0,horasPonto:0,qtdPonto:0,horasRetrabalho:0,qtdRetrabalho:0},
    Ele:  {horas:0,qtdAtiv:0,horasPonto:0,qtdPonto:0,horasRetrabalho:0,qtdRetrabalho:0},
    Lam:  {horas:0,qtdAtiv:0,horasPonto:0,qtdPonto:0,horasRetrabalho:0,qtdRetrabalho:0},
    Reb:  {horas:0,qtdAtiv:0,horasPonto:0,qtdPonto:0,horasRetrabalho:0,qtdRetrabalho:0},
  };
  for (const r of ativos) {
    if (!filtroLinha(r.linha)) continue;
    const key = classifyDept(r.setorMacro);
    if (!key) continue;
    acc[key].horas           += r.horas;
    acc[key].qtdAtiv         += r.qtdAtiv;
    acc[key].horasRetrabalho += r.horasRetrabalho;
    acc[key].qtdRetrabalho   += r.qtdRetrabalho;
  }
  for (const p of pontos) {
    if (!filtroLinha(p.linha)) continue;
    const key = classifyDept(p.setorMacro);
    if (!key) continue;
    acc[key].horasPonto += p.horasPonto;
    acc[key].qtdPonto   += p.qtdPonto;
  }
  return DEPT_KEYS.map(k => ({
    label:           DEPT_LABELS[k],
    horas:           acc[k].horas,
    horasReg:        acc[k].horasPonto,
    qtdAtiv:         acc[k].qtdAtiv,
    qtdPonto:        acc[k].qtdPonto,
    horasRetrabalho: acc[k].horasRetrabalho,
    qtdRetrabalho:   acc[k].qtdRetrabalho,
  }));
}

function agregarOpe(ativos: RawAtivRow[], pontos: RawPontoRow[]): AggRow[] {
  const grupos = [
    { label: 'Galpão 1', fn: (l: string) => LINHAS_MENORES.has(l) },
    { label: 'Galpão 2', fn: (l: string) => LINHAS_GALP2.has(l) },
    { label: 'Galpão 3', fn: (l: string) => LINHAS_GALP3.has(l) },
  ];
  return grupos.map(({ label, fn }) => {
    const subAtiv  = ativos.filter(r => fn(r.linha));
    const subPonto = pontos.filter(r => fn(r.linha));
    return {
      label,
      horas:           subAtiv.reduce((s, r)  => s + r.horas,           0),
      horasReg:        subPonto.reduce((s, r) => s + r.horasPonto,      0),
      qtdAtiv:         subAtiv.reduce((s, r)  => s + r.qtdAtiv,         0),
      qtdPonto:        subPonto.reduce((s, r) => s + r.qtdPonto,        0),
      horasRetrabalho: subAtiv.reduce((s, r)  => s + r.horasRetrabalho, 0),
      qtdRetrabalho:   subAtiv.reduce((s, r)  => s + r.qtdRetrabalho,   0),
    };
  });
}

/* ── Série diária de OPE ───────────────────────────────────── */
function buildDailySeries(
  ativos: RawAtivRow[],
  pontos: RawPontoRow[],
  filtroAtiv:  (r: RawAtivRow)  => boolean,
  filtroPonto: (r: RawPontoRow) => boolean,
): DailyPoint[] {
  const dates = new Set<string>();
  ativos.filter(filtroAtiv).forEach(r => dates.add(r.data));
  pontos.filter(filtroPonto).forEach(r => dates.add(r.data));
  return Array.from(dates)
    .sort((a, b) => parseDDMMYYYY(a) - parseDDMMYYYY(b))
    .map(data => {
      const ha = ativos.filter(r => filtroAtiv(r)  && r.data === data).reduce((s, r) => s + r.horas,      0);
      const hp = pontos.filter(r => filtroPonto(r) && r.data === data).reduce((s, r) => s + r.horasPonto, 0);
      return { data, ope: hp > 0 ? parseFloat((ha / hp * 100).toFixed(1)) : 0 };
    });
}

/* ── SQL Atividades ────────────────────────────────────────── */
function buildSqlAtividades(ini: string, fim: string, linhasArr: string[], setor: string): string {
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
  WHERE APO.DATA BETWEEN ${oracleInicio(ini)} AND ${oracleFim(fim)}
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
    COMP.RETRABALHO,
    ROW_NUMBER() OVER (
      PARTITION BY
        COMP.SEQ, PRJ.CODPROJPAI, SUBSTR(PRJ.IDENTIFICACAO, 1, 5), PRJ.IDENTIFICACAO,
        COMP.CODUSU, USU.NOMEUSU, COMP.CODPRODSP, PRO.DESCRPROD, COMP.QTD, COMP.FEITO, APO.DATA,
        COMP.RETRABALHO
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
  WHERE APO.DATA IS NOT NULL
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
  COUNT(CASE WHEN TB.RETRABALHO IS NULL     THEN 1 END)                                    AS QTD_REGISTROS,
  ROUND(SUM(CASE WHEN TB.RETRABALHO IS NULL     THEN TB.DURACAO ELSE 0 END) / 60, 2)      AS HORAS,
  COUNT(CASE WHEN TB.RETRABALHO IS NOT NULL THEN 1 END)                                    AS QTD_RETRABALHO,
  ROUND(SUM(CASE WHEN TB.RETRABALHO IS NOT NULL THEN TB.DURACAO ELSE 0 END) / 60, 2)      AS HORAS_RETRABALHO
FROM TAB_BASE TB
  JOIN SETOR_MACRO SM ON SM.AD_CODUSU = TB.COD_SETOR
WHERE TB.RN = 1
  AND SM.SETORMACRO = '${setor}'
GROUP BY TB.LINHA, TB.DATA_EXECUCAO, SM.SETORMACRO
ORDER BY TB.LINHA, TB.DATA_EXECUCAO, SM.SETORMACRO
`.trim();
}

/* ── SQL Ponto ─────────────────────────────────────────────── */
function buildSqlPonto(ini: string, fim: string, linhasArr: string[], setor: string): string {
  const linhasIn = linhasArr.map(l => `'${l}'`).join(',');
  return `
SELECT LINHA, DATA, SETORMACRO,
  COUNT(*)      AS QTD_REGISTROS,
  COUNT(*) * 8  AS HORAS_PONTO
FROM (
  SELECT
    PON.CODFUNC,
    TO_CHAR(PON.DTPONTO, 'DD/MM/YYYY') AS DATA,
    MIN('NX' || CASE SUBSTR(DEPL.CODPROJPAI, 3, 3)
                     WHEN '480' THEN '500'
                     ELSE SUBSTR(DEPL.CODPROJPAI, 3, 3)
                END) AS LINHA,
    DEPL.SETORMACRO
  FROM AD_BATPONTO PON
    JOIN TFPEQP EQ        ON EQ.CODEQP   = PON.CODEQP
    JOIN TFPFUN FUN       ON FUN.CODFUNC = PON.CODFUNC
    JOIN AD_DEPLINHA DEPL ON DEPL.CODDEP = FUN.CODDEP
  WHERE PON.DTPONTO BETWEEN ${oracleData(ini)} AND ${oracleData(fim)}
    AND EQ.AD_USADO     = '1'
    AND DEPL.SETORMACRO = '${setor}'
    AND DEPL.SETORMACRO IS NOT NULL
    AND DEPL.CODPROJPAI IS NOT NULL
  GROUP BY PON.CODFUNC, PON.DTPONTO, DEPL.SETORMACRO
)
WHERE LINHA IN (${linhasIn})
GROUP BY LINHA, DATA, SETORMACRO
ORDER BY LINHA, DATA, SETORMACRO
`.trim();
}

/* ── SQL Ponto Detalhe ─────────────────────────────────────── */
function buildSqlPontoDetalhe(ini: string, fim: string, linhasArr: string[], setor: string | null): string {
  const linhasIn = linhasArr.map(l => `'${l}'`).join(',');
  const linhaExpr = `'NX' || CASE SUBSTR(DEPL.CODPROJPAI, 3, 3) WHEN '480' THEN '500' ELSE SUBSTR(DEPL.CODPROJPAI, 3, 3) END`;
  return `
SELECT DISTINCT
  FUN.CODFUNC                           AS CODIGO,
  FUN.NOMEFUNC                          AS NOME,
  DEP.DESCRDEP                          AS DEPARTAMENTO_PROD,
  TO_CHAR(PON.DTPONTO, 'DD/MM/YYYY')   AS DATA
FROM AD_BATPONTO PON
JOIN TFPEQP EQ        ON EQ.CODEQP   = PON.CODEQP
JOIN TFPFUN FUN       ON FUN.CODFUNC = PON.CODFUNC
JOIN TFPDEP DEP       ON DEP.CODDEP  = FUN.CODDEP
JOIN AD_DEPLINHA DEPL ON DEPL.CODDEP = FUN.CODDEP
WHERE PON.DTPONTO BETWEEN ${oracleData(ini)} AND ${oracleData(fim)}
  AND EQ.AD_USADO        = '1'
  AND DEPL.CODPROJPAI IS NOT NULL
  AND DEPL.SETORMACRO IS NOT NULL
  AND ${linhaExpr} IN (${linhasIn})
${setor ? `  AND DEPL.SETORMACRO = '${setor}'` : ''}
ORDER BY NOME, DATA
`.trim();
}

type PontoDetalheRow = { codigo: string; nome: string; departamento: string; data: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPontoDetalhe(r: Record<string, any>): PontoDetalheRow {
  return {
    codigo:       String(r['CODIGO']            ?? r['codigo']            ?? ''),
    nome:         String(r['NOME']              ?? r['nome']              ?? ''),
    departamento: String(r['DEPARTAMENTO_PROD'] ?? r['departamento_prod'] ?? ''),
    data:         String(r['DATA']              ?? r['data']              ?? ''),
  };
}

/* ── Popup de detalhe de ponto ─────────────────────────────── */
function PontoDetalhePopup({ titulo, ini, fim, linhasArr, setor, onClose }: {
  titulo: string;
  ini: string;
  fim: string;
  linhasArr: string[];
  setor: string | null;
  onClose: () => void;
}) {
  const [rows, setRows]       = useState<PontoDetalheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setErro(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    obterReg<Record<string, any>>(buildSqlPontoDetalhe(ini, fim, linhasArr, setor))
      .then(res => setRows(res.map(mapPontoDetalhe)))
      .catch(() => setErro('Falha ao carregar detalhamento'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ini, fim, linhasArr.join(','), setor]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <span className="text-sm font-bold text-slate-800">Detalhe — {titulo}</span>
            <p className="text-xs text-slate-400 mt-0.5">{ini} até {fim}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-auto flex-1">
          {loading && <p className="px-5 py-4 text-xs text-slate-400">Carregando...</p>}
          {erro    && <p className="px-5 py-4 text-xs text-rose-500">{erro}</p>}
          {!loading && !erro && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Código</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Nome</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Departamento</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-1.5 text-slate-500 tabular-nums">{r.codigo}</td>
                    <td className="px-4 py-1.5 text-slate-800 font-medium">{r.nome}</td>
                    <td className="px-4 py-1.5 text-slate-600">{r.departamento}</td>
                    <td className="px-4 py-1.5 text-slate-500 tabular-nums">{r.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !erro && rows.length === 0 && (
            <p className="px-5 py-4 text-xs text-slate-400">Nenhum registro encontrado.</p>
          )}
        </div>
        <div className="px-5 py-2 border-t border-slate-100 text-xs text-slate-400 text-right">
          {!loading && !erro && `${rows.length} registros`}
        </div>
      </div>
    </div>
  );
}

/* ── Mapeadores ────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAtiv(r: Record<string, any>): RawAtivRow {
  return {
    linha:           String(r['LINHA']            ?? r['linha']            ?? ''),
    data:            String(r['DATA']             ?? r['data']             ?? ''),
    setorMacro:      String(r['SETORMACRO']       ?? r['setormacro']       ?? ''),
    horas:           Number(r['HORAS']            ?? r['horas']            ?? 0),
    qtdAtiv:         Number(r['QTD_REGISTROS']    ?? r['qtd_registros']    ?? 0),
    horasRetrabalho: Number(r['HORAS_RETRABALHO'] ?? r['horas_retrabalho'] ?? 0),
    qtdRetrabalho:   Number(r['QTD_RETRABALHO']   ?? r['qtd_retrabalho']   ?? 0),
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPonto(r: Record<string, any>): RawPontoRow {
  return {
    linha:      String(r['LINHA']         ?? r['linha']         ?? ''),
    data:       String(r['DATA']          ?? r['data']          ?? ''),
    setorMacro: String(r['SETORMACRO']    ?? r['setormacro']    ?? ''),
    qtdPonto:   Number(r['QTD_REGISTROS'] ?? r['qtd_registros'] ?? 0),
    horasPonto: Number(r['HORAS_PONTO']   ?? r['horas_ponto']   ?? 0),
  };
}

/* ── Gráfico de linha OPE diário ───────────────────────────── */
function OpeChart({ series, loading }: { series: DailyPoint[]; loading: boolean }) {
  if (loading) return (
    <div className="flex items-center justify-center h-full text-[10px] text-slate-300">Carregando...</div>
  );
  if (series.length === 0) return (
    <div className="flex items-center justify-center h-full text-[10px] text-slate-300">Sem dados</div>
  );

  const tickFormatter = (v: string) => v.slice(0, 5);
  const max = Math.max(...series.map(s => s.ope), 100);
  const yTicks = [0, 25, 50, 75, 100, ...(max > 100 ? [parseFloat(max.toFixed(1))] : [])];

  const data = series.map((pt, i) => {
    const janela = series.slice(Math.max(0, i - 6), i + 1);
    const mm7 = parseFloat((janela.reduce((s, p) => s + p.ope, 0) / janela.length).toFixed(1));
    return { ...pt, mm7 };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="data"
          tickFormatter={tickFormatter}
          tick={{ fontSize: 9, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, max]}
          ticks={yTicks}
          tick={{ fontSize: 9, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
          width={40}
        />
        <Tooltip
          formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name === 'mm7' ? 'MM 7d' : 'OPE']}
          labelFormatter={(l) => `Data: ${l}`}
          contentStyle={{ fontSize: 11, padding: '4px 8px' }}
        />
        {[25, 50, 75, 100].map(v => (
          <ReferenceLine key={v} y={v} stroke="#cbd5e1" strokeDasharray="3 3" />
        ))}
        {max > 100 && <ReferenceLine y={max} stroke="#cbd5e1" strokeDasharray="3 3" />}
        <Line type="monotone" dataKey="ope" stroke="#6366f1" strokeWidth={1.5} dot={{ r: 2, fill: '#6366f1' }} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="mm7" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}

const LABEL_TO_SETOR: Record<string, string> = {
  'Acabamento': 'ACAB', 'Montagem': 'MONT', 'Marcenaria': 'MARC',
  'Elétrica': 'ELET', 'Laminação': 'LAM', 'Rebarba': 'REB',
};

const OPE_LABEL_TO_LINHAS: Record<string, string[]> = {
  'Galpão 1': [...LINHAS_MENORES],
  'Galpão 2': [...LINHAS_GALP2],
  'Galpão 3': [...LINHAS_GALP3],
};

/* ── Tabela por seção ──────────────────────────────────────── */
function TabelaCard({ titulo, linhas, loading, ini, fim, linhasArr }: {
  titulo: string;
  linhas: AggRow[];
  loading: boolean;
  ini?: string;
  fim?: string;
  linhasArr?: string[];
}) {
  const [detalhe, setDetalhe] = useState<{ label: string; linhas: string[]; setor: string | null } | null>(null);

  function handleLabelClick(label: string) {
    if (!ini || !fim) return;
    const opeLinhas = OPE_LABEL_TO_LINHAS[label];
    if (opeLinhas) {
      setDetalhe({ label, linhas: opeLinhas, setor: null });
    } else if (linhasArr && LABEL_TO_SETOR[label]) {
      setDetalhe({ label, linhas: linhasArr, setor: LABEL_TO_SETOR[label] });
    }
  }
  const totAtivH   = linhas.reduce((s, l) => s + l.horas,           0);
  const totRetrabH = linhas.reduce((s, l) => s + l.horasRetrabalho, 0);
  const totPontoH  = linhas.reduce((s, l) => s + l.horasReg,        0);
  const ratio    = (a: number, b: number) => b > 0 ? `${(a / b * 100).toFixed(1)}%` : '—';
  const hasLoss  = (v: number) => v > 0;
  const fmtPend  = (v: number) => v === 0 ? '0,00' : (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
  const pendCls  = (v: number) => v === 0 ? 'text-slate-400' : 'text-rose-500';
  const col = 'grid-cols-[1fr_68px_68px_68px_68px_50px] gap-x-3';

  return (
    <>
    {detalhe && ini && fim && (
      <PontoDetalhePopup
        titulo={`${titulo} — ${detalhe.label}`}
        ini={ini} fim={fim}
        linhasArr={detalhe.linhas}
        setor={detalhe.setor}
        onClose={() => setDetalhe(null)}
      />
    )}
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{titulo}</span>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* cabeçalho único com grupos */}
        <div className={`grid ${col} px-3 py-1 border-b border-slate-100 bg-slate-50`}>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Setor</span>
          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider text-right pb-0.5 border-b-2 border-emerald-200">Ponto</span>
          <span className="text-[9px] font-bold text-blue-500    uppercase tracking-wider text-right pb-0.5 border-b-2 border-blue-200">Atividades</span>
          <span className="text-[9px] font-bold text-orange-400  uppercase tracking-wider text-right pb-0.5 border-b-2 border-orange-200">Perdas</span>
          <span className="text-[9px] font-bold text-rose-500    uppercase tracking-wider text-right pb-0.5 border-b-2 border-rose-200">Pendências</span>
          <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide text-right">OPE</span>
        </div>
        {loading ? (
          <p className="px-3 py-3 text-xs text-slate-300">Carregando...</p>
        ) : linhas.map(l => {
          const pend = l.horasReg - l.horas - l.horasRetrabalho;
          const isClickable = !!(ini && fim && (OPE_LABEL_TO_LINHAS[l.label] || (linhasArr && LABEL_TO_SETOR[l.label])));
          return (
            <div key={l.label} className={`grid ${col} px-3 py-1.5 border-b border-slate-50 last:border-0`}>
              <span
                className={`text-xs text-slate-700 truncate ${isClickable ? 'cursor-pointer hover:text-indigo-600 hover:underline' : ''}`}
                onClick={() => isClickable && handleLabelClick(l.label)}
              >{l.label}</span>
              <span className="text-xs font-semibold text-emerald-600 text-right tabular-nums">{l.horasReg.toFixed(2)}</span>
              <span className="text-xs font-semibold text-blue-600    text-right tabular-nums">{l.horas.toFixed(2)}</span>
              <span className="text-xs font-semibold text-orange-500  text-right tabular-nums">{hasLoss(l.horasRetrabalho) ? l.horasRetrabalho.toFixed(2) : '—'}</span>
              <span className={`text-xs font-semibold text-right tabular-nums ${pendCls(pend)}`}>{fmtPend(pend)}</span>
              <span className="text-xs font-semibold text-slate-900  text-right tabular-nums">{ratio(l.horas, l.horasReg)}</span>
            </div>
          );
        })}
        {!loading && (
          <div className={`grid ${col} px-3 py-1.5 border-t border-slate-200 bg-slate-50`}>
            <span className="text-xs font-bold text-slate-600">Total</span>
            <span className="text-xs font-bold text-emerald-700 text-right tabular-nums">{totPontoH.toFixed(2)}</span>
            <span className="text-xs font-bold text-blue-700    text-right tabular-nums">{totAtivH.toFixed(2)}</span>
            <span className="text-xs font-bold text-orange-600  text-right tabular-nums">{hasLoss(totRetrabH) ? totRetrabH.toFixed(2) : '—'}</span>
            <span className={`text-xs font-bold text-right tabular-nums ${pendCls(totPontoH - totAtivH - totRetrabH)}`}>{fmtPend(totPontoH - totAtivH - totRetrabH)}</span>
            <span className="text-xs font-bold text-slate-900  text-right tabular-nums">{ratio(totAtivH, totPontoH)}</span>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

/* ── Gráfico por seção ─────────────────────────────────────── */
function GraficoCard({ titulo, tipo, dadosAtivGraf, dadosPontoGraf, loading }: {
  titulo: string;
  tipo: 'maiores' | 'menores' | 'ope';
  dadosAtivGraf: RawAtivRow[];
  dadosPontoGraf: RawPontoRow[];
  loading: boolean;
}) {
  const [selecionado, setSelecionado] = useState('Geral');

  const series = useMemo(() => {
    const flBase = FILTRO_BASE[tipo];
    if (tipo === 'ope') {
      const opcao = OPCOES_GALP_GRAF.find(o => o.label === selecionado) ?? OPCOES_GALP_GRAF[0];
      return buildDailySeries(dadosAtivGraf, dadosPontoGraf, r => opcao.fn(r.linha), r => opcao.fn(r.linha));
    } else {
      const opcao = OPCOES_SETOR_GRAF.find(o => o.label === selecionado) ?? OPCOES_SETOR_GRAF[0];
      return buildDailySeries(
        dadosAtivGraf, dadosPontoGraf,
        r => flBase(r.linha) && (opcao.sm == null || r.setorMacro === opcao.sm),
        r => flBase(r.linha) && (opcao.sm == null || r.setorMacro === opcao.sm),
      );
    }
  }, [dadosAtivGraf, dadosPontoGraf, selecionado, tipo]);

  const opcoesBotoes = tipo === 'ope'
    ? OPCOES_GALP_GRAF.map(o => o.label)
    : OPCOES_SETOR_GRAF.map(o => o.label);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{titulo}</span>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col p-3">
        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5">OPE diário</span>
        <div className="flex flex-wrap gap-1 mb-2">
          {opcoesBotoes.map(label => (
            <button
              key={label}
              onClick={() => setSelecionado(label)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                selecionado === label
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-[110px]">
          <OpeChart series={series} loading={loading} />
        </div>
      </div>
    </div>
  );
}

/* ── Modal principal ────────────────────────────────────────── */
type Props = { onClose: () => void };

export function OpeDetalhamentoModal({ onClose }: Props) {
  const [periodoTab,  setPeriodoTab]  = useState({ ini: hoje(),           fim: hoje() });
  const [periodoGraf, setPeriodoGraf] = useState({ ini: primeiroDiaMes(), fim: hoje() });

  const [dadosAtiv,      setDadosAtiv]      = useState<RawAtivRow[]>([]);
  const [dadosPonto,     setDadosPonto]     = useState<RawPontoRow[]>([]);
  const [loadingTab,     setLoadingTab]     = useState(false);
  const [erroTab,        setErroTab]        = useState<string | null>(null);

  const [dadosAtivGraf,  setDadosAtivGraf]  = useState<RawAtivRow[]>([]);
  const [dadosPontoGraf, setDadosPontoGraf] = useState<RawPontoRow[]>([]);
  const [loadingGraf,    setLoadingGraf]    = useState(false);
  const [erroGraf,       setErroGraf]       = useState<string | null>(null);

  /* fetch tabela — disparado manualmente */
  function fetchTabela(ini: string, fim: string) {
    setLoadingTab(true); setErroTab(null);
    const queries = [LINHAS_MAIORES_ARR, LINHAS_MENORES_ARR].flatMap(linhas =>
      SETORES_SQL.flatMap(setor => [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obterReg<Record<string, any>>(buildSqlAtividades(ini, fim, linhas, setor)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obterReg<Record<string, any>>(buildSqlPonto(ini, fim, linhas, setor)),
      ])
    );
    Promise.all(queries)
      .then(results => {
        const ativos: RawAtivRow[]  = [];
        const pontos: RawPontoRow[] = [];
        for (let i = 0; i < results.length; i += 2) {
          results[i].forEach(r => ativos.push(mapAtiv(r)));
          results[i + 1].forEach(r => pontos.push(mapPonto(r)));
        }
        setDadosAtiv(ativos);
        setDadosPonto(pontos);
      })
      .catch(() => setErroTab('Falha ao carregar tabela'))
      .finally(() => setLoadingTab(false));
  }

  /* fetch gráfico — disparado manualmente */
  function fetchGrafico(ini: string, fim: string) {
    setLoadingGraf(true); setErroGraf(null);
    const queries = [LINHAS_MAIORES_ARR, LINHAS_MENORES_ARR].flatMap(linhas =>
      SETORES_SQL.flatMap(setor => [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obterReg<Record<string, any>>(buildSqlAtividades(ini, fim, linhas, setor)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obterReg<Record<string, any>>(buildSqlPonto(ini, fim, linhas, setor)),
      ])
    );
    Promise.all(queries)
      .then(results => {
        const ativos: RawAtivRow[]  = [];
        const pontos: RawPontoRow[] = [];
        for (let i = 0; i < results.length; i += 2) {
          results[i].forEach(r => ativos.push(mapAtiv(r)));
          results[i + 1].forEach(r => pontos.push(mapPonto(r)));
        }
        setDadosAtivGraf(ativos);
        setDadosPontoGraf(pontos);
      })
      .catch(() => setErroGraf('Falha ao carregar gráfico'))
      .finally(() => setLoadingGraf(false));
  }

  function handleAplicarTab() {
    if (!periodoTab.ini || !periodoTab.fim) return;
    fetchTabela(periodoTab.ini, periodoTab.fim);
  }

  function handleAplicarGraf() {
    if (!periodoGraf.ini || !periodoGraf.fim) return;
    fetchGrafico(periodoGraf.ini, periodoGraf.fim);
  }

  const maiores = useMemo(() => agregar(dadosAtiv, dadosPonto, l => LINHAS_MAIORES.has(l)), [dadosAtiv, dadosPonto]);
  const menores = useMemo(() => agregar(dadosAtiv, dadosPonto, l => LINHAS_MENORES.has(l)), [dadosAtiv, dadosPonto]);
  const ope     = useMemo(() => agregarOpe(dadosAtiv, dadosPonto),                           [dadosAtiv, dadosPonto]);

  const inputCls = 'rounded border border-slate-200 px-2 py-1 text-xs text-slate-800 outline-none focus:border-indigo-400';
  const labelCls = 'text-xs text-slate-400 shrink-0';

  const btnAplicar = (disabled: boolean, loading: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-semibold hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? 'Carregando...' : 'Aplicar'}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-slate-800">Detalhamento OPE</h2>
            <p className="text-xs text-slate-500 mt-0.5">Atividades e ponto por setor — Galpão 3, Galpão 1 + Galpão 2 e OPE geral</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo: empilha em mobile, lado a lado em md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">

          {/* ── Coluna esquerda: Tabelas ── */}
          <div className="flex flex-col">
            {/* Filtro tabela */}
            <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b border-slate-100 bg-white">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Período — Tabela</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className={labelCls}>De</label>
                  <input type="date" value={toInput(periodoTab.ini)} onChange={e => setPeriodoTab(p => ({ ...p, ini: fromInput(e.target.value) }))} className={inputCls} />
                  <label className={labelCls}>Até</label>
                  <input type="date" value={toInput(periodoTab.fim)} onChange={e => setPeriodoTab(p => ({ ...p, fim: fromInput(e.target.value) }))} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {erroTab && <span className="text-xs text-rose-500">{erroTab}</span>}
                {btnAplicar(!periodoTab.ini || !periodoTab.fim || loadingTab, loadingTab, handleAplicarTab)}
              </div>
            </div>

            {/* Tabelas */}
            <div className="flex flex-col gap-5 p-5">
              <TabelaCard titulo="Galpão 3 (NX 500 - NX 620)"          linhas={maiores} loading={loadingTab} ini={periodoTab.ini} fim={periodoTab.fim} linhasArr={LINHAS_MAIORES_ARR} />
              <TabelaCard titulo="Galpão 1 + Galpão 2 (NX 260 - NX 440)" linhas={menores} loading={loadingTab} ini={periodoTab.ini} fim={periodoTab.fim} linhasArr={LINHAS_MENORES_ARR} />
              <TabelaCard titulo="OPE"                                    linhas={ope}     loading={loadingTab} ini={periodoTab.ini} fim={periodoTab.fim} />
            </div>
          </div>

          {/* ── Coluna direita: Gráficos ── */}
          <div className="flex flex-col">
            {/* Filtro gráfico */}
            <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b border-slate-100 bg-white">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Período — Gráfico</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className={labelCls}>De</label>
                  <input type="date" value={toInput(periodoGraf.ini)} onChange={e => setPeriodoGraf(p => ({ ...p, ini: fromInput(e.target.value) }))} className={inputCls} />
                  <label className={labelCls}>Até</label>
                  <input type="date" value={toInput(periodoGraf.fim)} onChange={e => setPeriodoGraf(p => ({ ...p, fim: fromInput(e.target.value) }))} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {erroGraf && <span className="text-xs text-rose-500">{erroGraf}</span>}
                {btnAplicar(!periodoGraf.ini || !periodoGraf.fim || loadingGraf, loadingGraf, handleAplicarGraf)}
              </div>
            </div>

            {/* Gráficos */}
            <div className="flex flex-col gap-5 p-5">
              <GraficoCard titulo="Galpão 3 (NX 500 - NX 620)" tipo="maiores" dadosAtivGraf={dadosAtivGraf} dadosPontoGraf={dadosPontoGraf} loading={loadingGraf} />
              <GraficoCard titulo="Galpão 1 + Galpão 2 (NX 260 - NX 440)" tipo="menores" dadosAtivGraf={dadosAtivGraf} dadosPontoGraf={dadosPontoGraf} loading={loadingGraf} />
              <GraficoCard titulo="OPE"           tipo="ope"     dadosAtivGraf={dadosAtivGraf} dadosPontoGraf={dadosPontoGraf} loading={loadingGraf} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
