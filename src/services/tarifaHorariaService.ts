import { obterReg } from '@/lib/api';
import type { TarifaLinha } from '@/data/mockTarifaHoraria';

type RawRow = unknown;

function ultimoDia(mes: number, ano: number): string {
  return String(new Date(ano, mes, 0).getDate()).padStart(2, '0');
}
function pad2(n: number) { return String(n).padStart(2, '0'); }

function pick(r: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (r[k] != null) return r[k];
  return null;
}
function num(r: Record<string, unknown>, ...keys: string[]): number {
  const v = pick(r, ...keys);
  return v != null ? Number(v) : 0;
}

// ── Horas por Linha ───────────────────────────────────────────────────────────

function buildHorasSql(mes: number, ano: number): string {
  const anoAnt = ano - 1;
  const fim = `${ultimoDia(mes, ano)}/${pad2(mes)}/${ano}`;

  const mesesPivot = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `SUM(CASE WHEN EXTRACT(YEAR FROM DATA)=${ano} AND EXTRACT(MONTH FROM DATA)=${m} THEN DURACAO ELSE 0 END) AS M${pad2(m)}`;
  }).join(',\n  ');

  const mesesPivotAnt = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `SUM(CASE WHEN EXTRACT(YEAR FROM DATA)=${anoAnt} AND EXTRACT(MONTH FROM DATA)=${m} THEN DURACAO ELSE 0 END) AS M${pad2(m)}_ANT`;
  }).join(',\n  ');

  return `
WITH TAB_APO AS (
  SELECT LIN.DESCRICAO, APO.*
  FROM AD_CRONOGRAMA CRO
  LEFT JOIN AD_DETALCRONOGRAMA DET ON DET.SEQ = CRO.SEQ
  LEFT JOIN AD_APOAVANCO APO ON (APO.SEQ = DET.SEQ AND APO.CODUSU = DET.CODUSU)
  LEFT JOIN TGFPRO PRO ON APO.CODPRODSP = PRO.CODPROD
  INNER JOIN TCSPRJ PRJ ON (PRJ.CODPROJ = CRO.CODPROJ)
  JOIN TCSPRJ PAI ON PAI.CODPROJ = PRJ.CODPROJPAI
  JOIN TGFGRU G ON G.CODGRUPOPROD = PAI.AD_CODGRUPOPROD
  JOIN AD_LINHAPROD LIN ON LIN.CODLINHAPROD = G.AD_CODLINHAPROD
  INNER JOIN TSIUSU USU ON USU.CODUSU = APO.CODUSU
  WHERE APO.DATA BETWEEN '01/01/${anoAnt}' AND '${fim}'
)
SELECT
  DESCRICAO,
  SUM(CASE WHEN EXTRACT(YEAR FROM DATA)=${anoAnt} THEN DURACAO ELSE 0 END) AS FY_ANT,
  ${mesesPivot},
  SUM(CASE WHEN EXTRACT(YEAR FROM DATA)=${anoAnt} AND EXTRACT(MONTH FROM DATA)<=${mes} THEN DURACAO ELSE 0 END) AS YTD_ANT,
  SUM(CASE WHEN EXTRACT(YEAR FROM DATA)=${ano}    AND EXTRACT(MONTH FROM DATA)<=${mes} THEN DURACAO ELSE 0 END) AS YTD_ATU,
  ${mesesPivotAnt}
FROM (
  SELECT APO.DESCRICAO, APO.DATA AS DATA, COMP.QTD / 60 AS DURACAO
  FROM AD_COMPONENTECRONO COMP
  LEFT JOIN TAB_APO APO
    ON APO.SEQ = COMP.SEQ
   AND APO.CODUSU = COMP.CODUSU
   AND APO.CODPRODSP = COMP.CODPRODSP
  WHERE COMP.RETRABALHO IS NULL AND APO.DATA IS NOT NULL
)
GROUP BY DESCRICAO
ORDER BY DESCRICAO
  `.trim();
}

function mapHorasRow(raw: RawRow): TarifaLinha {
  if (Array.isArray(raw)) {
    // colunas: DESCRICAO, FY_ANT, M01-M12, YTD_ANT, YTD_ATU, M01_ANT-M12_ANT
    const a = raw as unknown[];
    const ytdA = Number(a[14] ?? 0), ytdU = Number(a[15] ?? 0);
    return {
      linha: String(a[0] ?? ''), fyAnt: Number(a[1] ?? 0),
      m01: Number(a[2]??0), m02: Number(a[3]??0), m03: Number(a[4]??0), m04: Number(a[5]??0),
      m05: Number(a[6]??0), m06: Number(a[7]??0), m07: Number(a[8]??0), m08: Number(a[9]??0),
      m09: Number(a[10]??0), m10: Number(a[11]??0), m11: Number(a[12]??0), m12: Number(a[13]??0),
      ytdAnt: ytdA, ytdAtu: ytdU,
      pct: ytdA !== 0 ? Math.round((ytdU / ytdA - 1) * 100) : null,
      m01Ant: Number(a[16]??0), m02Ant: Number(a[17]??0), m03Ant: Number(a[18]??0), m04Ant: Number(a[19]??0),
      m05Ant: Number(a[20]??0), m06Ant: Number(a[21]??0), m07Ant: Number(a[22]??0), m08Ant: Number(a[23]??0),
      m09Ant: Number(a[24]??0), m10Ant: Number(a[25]??0), m11Ant: Number(a[26]??0), m12Ant: Number(a[27]??0),
    };
  }
  const r = raw as Record<string, unknown>;
  const ytdAnt = num(r, 'YTD_ANT', 'ytd_ant');
  const ytdAtu = num(r, 'YTD_ATU', 'ytd_atu');
  return {
    linha: String(pick(r, 'DESCRICAO', 'descricao') ?? ''),
    fyAnt: num(r, 'FY_ANT', 'fy_ant'),
    m01: num(r,'M01','m01'), m02: num(r,'M02','m02'), m03: num(r,'M03','m03'), m04: num(r,'M04','m04'),
    m05: num(r,'M05','m05'), m06: num(r,'M06','m06'), m07: num(r,'M07','m07'), m08: num(r,'M08','m08'),
    m09: num(r,'M09','m09'), m10: num(r,'M10','m10'), m11: num(r,'M11','m11'), m12: num(r,'M12','m12'),
    ytdAnt, ytdAtu, pct: ytdAnt !== 0 ? Math.round((ytdAtu / ytdAnt - 1) * 100) : null,
    m01Ant: num(r,'M01_ANT','m01_ant'), m02Ant: num(r,'M02_ANT','m02_ant'),
    m03Ant: num(r,'M03_ANT','m03_ant'), m04Ant: num(r,'M04_ANT','m04_ant'),
    m05Ant: num(r,'M05_ANT','m05_ant'), m06Ant: num(r,'M06_ANT','m06_ant'),
    m07Ant: num(r,'M07_ANT','m07_ant'), m08Ant: num(r,'M08_ANT','m08_ant'),
    m09Ant: num(r,'M09_ANT','m09_ant'), m10Ant: num(r,'M10_ANT','m10_ant'),
    m11Ant: num(r,'M11_ANT','m11_ant'), m12Ant: num(r,'M12_ANT','m12_ant'),
  };
}

function calcGrandTotal(rows: TarifaLinha[]): TarifaLinha {
  const s = (k: keyof TarifaLinha) => rows.reduce((a, r) => a + (r[k] as number), 0);
  const ytdAnt = s('ytdAnt'), ytdAtu = s('ytdAtu');
  return {
    linha: 'Grand Total', isBold: true, fyAnt: s('fyAnt'),
    m01:s('m01'), m02:s('m02'), m03:s('m03'), m04:s('m04'),
    m05:s('m05'), m06:s('m06'), m07:s('m07'), m08:s('m08'),
    m09:s('m09'), m10:s('m10'), m11:s('m11'), m12:s('m12'),
    ytdAnt, ytdAtu, pct: ytdAnt !== 0 ? Math.round((ytdAtu / ytdAnt - 1) * 100) : null,
  };
}

export async function getHorasPorLinha(mes: number, ano: number): Promise<TarifaLinha[]> {
  const rows = await obterReg<RawRow>(buildHorasSql(mes, ano));
  const mapped = rows.map(mapHorasRow);
  return [...mapped, calcGrandTotal(mapped)];
}

// ── Drill-down Horas: chassis ─────────────────────────────────────────────────

export type ChassiRow = { chassi: string; hh: number };

function buildChassisDrillSql(linha: string, mes: number, ano: number): string {
  const ini = `01/${pad2(mes)}/${ano}`;
  const fim = `${ultimoDia(mes, ano)}/${pad2(mes)}/${ano}`;
  const linhaEsc = linha.replace(/'/g, "''");
  return `
WITH TAB_APO AS (
  SELECT LIN.DESCRICAO, APO.*
  FROM AD_CRONOGRAMA CRO
  LEFT JOIN AD_DETALCRONOGRAMA DET ON DET.SEQ = CRO.SEQ
  LEFT JOIN AD_APOAVANCO APO ON (APO.SEQ = DET.SEQ AND APO.CODUSU = DET.CODUSU)
  LEFT JOIN TGFPRO PRO ON APO.CODPRODSP = PRO.CODPROD
  INNER JOIN TCSPRJ PRJ ON (PRJ.CODPROJ = CRO.CODPROJ)
  JOIN TCSPRJ PAI ON PAI.CODPROJ = PRJ.CODPROJPAI
  JOIN TGFGRU G ON G.CODGRUPOPROD = PAI.AD_CODGRUPOPROD
  JOIN AD_LINHAPROD LIN ON LIN.CODLINHAPROD = G.AD_CODLINHAPROD
  INNER JOIN TSIUSU USU ON USU.CODUSU = APO.CODUSU
  WHERE APO.DATA BETWEEN '${ini}' AND '${fim}'
)
SELECT CHASSI, SUM(DURACAO) / 60 AS HH
FROM (
  SELECT PRJ.IDENTIFICACAO AS CHASSI, COMP.QTD AS DURACAO
  FROM AD_COMPONENTECRONO COMP
  LEFT JOIN TAB_APO APO ON APO.SEQ=COMP.SEQ AND APO.CODUSU=COMP.CODUSU AND APO.CODPRODSP=COMP.CODPRODSP
  LEFT JOIN TGFPRO PRO ON PRO.CODPROD = COMP.CODPRODSP
  LEFT JOIN TSIUSU USU ON USU.CODUSU = COMP.CODUSU
  LEFT JOIN AD_CRONOGRAMA CRO ON CRO.SEQ = COMP.SEQ
  LEFT JOIN TCSPRJ PRJ ON PRJ.CODPROJ = CRO.CODPROJ
  WHERE COMP.RETRABALHO IS NULL AND APO.DATA IS NOT NULL AND APO.DESCRICAO = '${linhaEsc}'
)
GROUP BY CHASSI
ORDER BY CHASSI
  `.trim();
}

export async function getChassisDrillDown(linha: string, mes: number, ano: number): Promise<ChassiRow[]> {
  const rows = await obterReg<unknown>(buildChassisDrillSql(linha, mes, ano));
  return rows.map((r) => {
    if (Array.isArray(r)) return { chassi: String(r[0] ?? ''), hh: Number(r[1] ?? 0) };
    const o = r as Record<string, unknown>;
    return { chassi: String(o['CHASSI'] ?? o['chassi'] ?? ''), hh: Number(o['HH'] ?? o['hh'] ?? 0) };
  });
}

// ── Contábil genérico (Payroll, Overhead, Kanban, Resin, SG&A…) ──────────────

export type DrillItem = { label: string; value: number };

const CONTABIL_JOINS = `
FROM TCBLAN L
JOIN TCBPLA P  ON L.CODCTACTB = P.CODCTACTB
JOIN TSICUS C  ON L.CODCENCUS = C.CODCENCUS
LEFT JOIN TSIEMP E ON E.CODEMP = L.CODEMPORIG`.trim();

function numloteClause(numlote: number | number[]): string {
  if (Array.isArray(numlote)) return `NVL(L.NUMLOTE, 0) IN (${numlote.join(', ')})`;
  return `NVL(L.NUMLOTE, 0) = ${numlote}`;
}

function contabilWhere(contas: string, numlote: number | number[], ini: string, fim: string) {
  return `L.DTMOV >= SNK_TRUNC_DATE(TO_DATE('${ini}', 'DD/MM/YYYY'), 'DD')
    AND L.DTMOV <= SNK_TRUNC_DATE(TO_DATE('${fim}', 'DD/MM/YYYY'), 'DD')
    AND L.CODEMP = 1
    AND P.CTACTB IN (${contas})
    AND ${numloteClause(numlote)}`;
}

function buildContabilPivotSql(contas: string, numlote: number | number[], mes: number, ano: number): string {
  const anoAnt = ano - 1;
  const fim = `${ultimoDia(mes, ano)}/${pad2(mes)}/${ano}`;
  const pivot = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `SUM(CASE WHEN EXTRACT(YEAR FROM L.DTMOV)=${ano} AND EXTRACT(MONTH FROM L.DTMOV)=${m} THEN NVL(L.VLRLANC,0) ELSE 0 END) AS M${pad2(m)}`;
  }).join(',\n  ');
  const pivotAnt = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `SUM(CASE WHEN EXTRACT(YEAR FROM L.DTMOV)=${anoAnt} AND EXTRACT(MONTH FROM L.DTMOV)=${m} THEN NVL(L.VLRLANC,0) ELSE 0 END) AS M${pad2(m)}_ANT`;
  }).join(',\n  ');
  return `
SELECT
  SUM(CASE WHEN EXTRACT(YEAR FROM L.DTMOV)=${anoAnt} THEN NVL(L.VLRLANC,0) ELSE 0 END) AS FY_ANT,
  ${pivot},
  SUM(CASE WHEN EXTRACT(YEAR FROM L.DTMOV)=${anoAnt} AND EXTRACT(MONTH FROM L.DTMOV)<=${mes} THEN NVL(L.VLRLANC,0) ELSE 0 END) AS YTD_ANT,
  SUM(CASE WHEN EXTRACT(YEAR FROM L.DTMOV)=${ano}    AND EXTRACT(MONTH FROM L.DTMOV)<=${mes} THEN NVL(L.VLRLANC,0) ELSE 0 END) AS YTD_ATU,
  ${pivotAnt}
${CONTABIL_JOINS}
WHERE ${contabilWhere(contas, numlote, `01/01/${anoAnt}`, fim)}
  `.trim();
}

function buildContabilDrillSql(contas: string, numlote: number | number[], mes: number, ano: number): string {
  const ini = `01/${pad2(mes)}/${ano}`;
  const fim = `${ultimoDia(mes, ano)}/${pad2(mes)}/${ano}`;
  return `
SELECT P.DESCRCTA AS LABEL, SUM(NVL(L.VLRLANC,0)) AS VALUE
${CONTABIL_JOINS}
WHERE ${contabilWhere(contas, numlote, ini, fim)}
GROUP BY P.DESCRCTA
ORDER BY VALUE DESC
  `.trim();
}

function mapContabilRow(r: unknown, linha: string, trend?: 'up' | 'down'): TarifaLinha {
  let fyAnt=0, ytdAnt=0, ytdAtu=0;
  const m: number[] = Array(12).fill(0);
  const mAnt: number[] = Array(12).fill(0);
  if (Array.isArray(r)) {
    // colunas: FY_ANT, M01-M12, YTD_ANT, YTD_ATU, M01_ANT-M12_ANT
    const a = r as unknown[];
    fyAnt  = Number(a[0]  ?? 0);
    for (let i=0;i<12;i++) m[i] = Number(a[i+1] ?? 0);
    ytdAnt = Number(a[13] ?? 0);
    ytdAtu = Number(a[14] ?? 0);
    for (let i=0;i<12;i++) mAnt[i] = Number(a[i+15] ?? 0);
  } else {
    const o = r as Record<string, unknown>;
    fyAnt  = num(o, 'FY_ANT', 'fy_ant');
    for (let i=0;i<12;i++) m[i] = num(o, `M${pad2(i+1)}`, `m${pad2(i+1)}`);
    ytdAnt = num(o, 'YTD_ANT', 'ytd_ant');
    ytdAtu = num(o, 'YTD_ATU', 'ytd_atu');
    for (let i=0;i<12;i++) mAnt[i] = num(o, `M${pad2(i+1)}_ANT`, `m${pad2(i+1)}_ant`);
  }
  const pct = ytdAnt !== 0 ? Math.round((ytdAtu / ytdAnt - 1) * 100) : null;
  return {
    linha, trend: trend ?? null, fyAnt,
    m01:m[0], m02:m[1], m03:m[2], m04:m[3], m05:m[4], m06:m[5],
    m07:m[6], m08:m[7], m09:m[8], m10:m[9], m11:m[10], m12:m[11],
    ytdAnt, ytdAtu, pct,
    m01Ant:mAnt[0], m02Ant:mAnt[1], m03Ant:mAnt[2], m04Ant:mAnt[3],
    m05Ant:mAnt[4], m06Ant:mAnt[5], m07Ant:mAnt[6], m08Ant:mAnt[7],
    m09Ant:mAnt[8], m10Ant:mAnt[9], m11Ant:mAnt[10], m12Ant:mAnt[11],
  };
}

async function getContabilPorMes(
  contas: string, numlote: number | number[], linha: string, mes: number, ano: number, trend?: 'up' | 'down',
): Promise<TarifaLinha> {
  const rows = await obterReg<unknown>(buildContabilPivotSql(contas, numlote, mes, ano));
  if (!rows[0]) return { linha, trend: trend ?? null, fyAnt:0, m01:0,m02:0,m03:0,m04:0,m05:0,m06:0,m07:0,m08:0,m09:0,m10:0,m11:0,m12:0, ytdAnt:0, ytdAtu:0, pct:null };
  return mapContabilRow(rows[0], linha, trend);
}

async function getContabilDrillDown(contas: string, numlote: number | number[], mes: number, ano: number): Promise<DrillItem[]> {
  const rows = await obterReg<unknown>(buildContabilDrillSql(contas, numlote, mes, ano));
  return rows.map((r) => {
    if (Array.isArray(r)) return { label: String(r[0] ?? ''), value: Number(r[1] ?? 0) };
    const o = r as Record<string, unknown>;
    return { label: String(o['LABEL'] ?? o['label'] ?? ''), value: Number(o['VALUE'] ?? o['value'] ?? 0) };
  });
}

// ── Contas por categoria ──────────────────────────────────────────────────────

const PAYROLL_CONTAS = [
  '5.2.1.01.001','5.3.1.01.001','5.2.1.02.001','5.3.1.02.001',
  '5.2.1.01.003','5.3.1.01.003','5.3.1.04.002','5.2.1.01.005',
  '5.3.1.01.005','5.2.1.01.009','5.3.1.01.009','5.2.1.04.001',
  '5.3.1.04.001','5.2.1.02.002','5.3.1.02.002','5.2.1.04.011',
  '5.3.1.04.011','5.2.1.01.006','5.3.1.01.006','5.2.1.01.004',
  '5.3.1.01.004','5.2.1.04.005','5.3.1.04.005','5.2.1.01.010',
  '5.3.1.01.010','5.2.1.04.006','5.3.1.04.006','5.2.1.01.008',
  '5.3.1.01.008','5.3.1.01.011','5.2.1.04.010','5.3.1.04.010',
  '5.2.1.04.004','5.3.1.04.004','5.2.1.04.003','5.3.1.04.003',
  '5.3.1.01.007',
].map(a => `'${a}'`).join(',');

const OVERHEAD_CONTAS = [
  '5.3.1.05.008','5.3.1.05.010','5.3.1.05.002','5.3.1.05.012',
  '5.3.1.06.006','5.3.1.06.015','5.3.1.06.018','5.3.1.06.012',
  '5.3.1.06.021','5.3.1.05.019','5.3.1.06.022','5.3.1.06.013',
  '5.3.1.05.009','5.3.1.05.011','5.3.1.06.007','5.3.1.06.016',
  '5.3.1.06.003','5.3.1.10.002','5.3.1.05.001','5.3.1.05.005',
  '5.3.1.07.002','5.3.1.08.001','5.3.1.05.018','5.3.1.06.001',
  '5.3.1.06.004','5.3.1.06.009','5.3.1.05.003','5.3.1.05.004',
  '5.3.1.05.006','5.3.1.08.002','5.3.1.06.010','5.3.1.09.001',
  '5.3.1.09.999',
].map(a => `'${a}'`).join(',');

const SGA_CONTAS = [
  '6.1.2.04.007','6.1.2.05.012','6.1.2.01.002','6.1.2.02.003',
  '6.1.2.05.014','6.1.2.04.018','6.1.2.04.017','6.1.1.01.001',
  '6.1.1.01.003','6.1.1.01.004','6.1.1.01.005','6.1.1.01.008',
  '6.1.1.02.001','6.1.1.02.002','6.1.1.04.001','6.1.1.04.003',
  '6.1.1.04.004','6.1.1.04.005','6.1.1.04.006','6.1.1.04.010',
  '6.1.1.04.011','6.1.2.02.004','6.1.2.04.001','6.1.2.04.003',
  '6.1.2.04.006','6.1.2.04.008','6.1.2.04.009','6.1.2.04.010',
  '6.1.2.04.012','6.1.2.04.013','6.1.2.04.016','6.1.2.05.001',
  '6.1.2.05.003','6.1.2.05.006','6.1.2.05.007','6.1.2.05.009',
  '6.1.2.05.010','6.1.2.05.011','6.1.2.05.013','6.2.1.01.001',
  '6.2.1.01.003','6.2.1.01.004','6.2.1.01.005','6.2.1.01.006',
  '6.2.1.01.007','6.2.1.01.008','6.2.1.01.009','6.2.1.01.013',
  '6.2.1.02.001','6.2.1.02.002','6.2.1.03.001','6.2.1.04.001',
  '6.2.1.04.003','6.2.1.04.004','6.2.1.04.005','6.2.1.04.006',
  '6.2.1.04.010','6.2.1.04.011','6.2.1.05.001','6.2.1.05.004',
  '6.2.1.05.005','6.2.1.05.008','6.2.1.05.009','6.2.1.05.011',
  '6.2.1.05.012','6.2.1.05.014','6.2.1.05.018','6.2.1.05.023',
  '6.2.1.05.025','6.2.1.06.004','6.2.1.06.005','6.2.1.06.006',
  '6.2.1.06.007','6.2.1.06.008','6.2.1.06.009','6.2.1.06.011',
  '6.2.1.06.013','6.2.1.06.015','6.2.1.06.016','6.2.1.06.018',
  '6.2.1.07.001','6.2.1.07.002','6.2.1.07.003','6.2.1.08.002',
].map(a => `'${a}'`).join(',');

// ── API pública ───────────────────────────────────────────────────────────────

export const getPayrollPorMes   = (mes: number, ano: number) => getContabilPorMes(PAYROLL_CONTAS,  100, 'Payroll',  mes, ano, 'up');
export const getOverheadPorMes  = (mes: number, ano: number) => getContabilPorMes(OVERHEAD_CONTAS, 100, 'Overhead', mes, ano, 'up');
export const getSgaPorMes       = (mes: number, ano: number) => getContabilPorMes(SGA_CONTAS,      [2, 4], 'SG&A',     mes, ano, 'up');

export const getPayrollDrillDown  = (mes: number, ano: number) => getContabilDrillDown(PAYROLL_CONTAS,  100, mes, ano);
export const getOverheadDrillDown = (mes: number, ano: number) => getContabilDrillDown(OVERHEAD_CONTAS, 100, mes, ano);
export const getSgaDrillDown      = (mes: number, ano: number) => getContabilDrillDown(SGA_CONTAS,      [2, 4], mes, ano);
