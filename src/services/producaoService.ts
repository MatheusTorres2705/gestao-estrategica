import { obterReg } from '@/lib/api';

const LINHAS_MAIORES = new Set(['NX260','NX270','NX280','NX290','NX310','NX340','NX350','NX360','NX370']);
const LINHAS_GALP2   = new Set(['NX410','NX440']);
const LINHAS_GALP3   = new Set(['NX500','NX620']);
const LINHAS_MAIORES_ARR = ['NX260','NX270','NX280','NX290','NX310','NX340','NX350','NX360','NX370'];
const LINHAS_MENORES_ARR = ['NX410','NX440','NX500','NX620','NX62'];
const SETORES_SQL = ['ACAB','MONT','MARC','ELET','LAM','REB'];

type RawAtivRow  = { linha: string; data: string; setorMacro: string; horas: number; qtdAtiv: number };
type RawPontoRow = { linha: string; data: string; setorMacro: string; qtdPonto: number; horasPonto: number };
type AggRow      = { label: string; horas: number; horasReg: number; qtdAtiv: number; qtdPonto: number };
type RawBarcoRow = { chassi: string; linha: string; mes: number; ano: number; pctConclu: number };

function _oracleInicio(s: string) { return `TO_DATE('${s} 00:00:00', 'DD/MM/YYYY HH24:MI:SS')`; }
function _oracleFim(s: string)    { return `TO_DATE('${s} 23:59:59', 'DD/MM/YYYY HH24:MI:SS')`; }
function _oracleData(s: string)   { return `TO_DATE('${s}', 'DD/MM/YYYY')`; }

function buildSqlBarcosEntregues(mes: number, ano: number): string {
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
  WHERE APO.DATA > TO_DATE('01/01/${ano - 1}', 'DD/MM/YYYY')
    AND SUBSTR(PRJ.IDENTIFICACAO, 1, 5) IN (
      'NX260','NX270','NX280','NX290','NX310',
      'NX340','NX350','NX360','NX370','NX410','NX440','NX500','NX620','NX62'
    )
),
TAB_ATIVIDADES AS (
  SELECT
    COMP.SEQ          AS COD_SEQUENCIAL,
    CRO.MES,
    CRO.ANO,
    SUBSTR(PRJ.IDENTIFICACAO, 1, 5) AS LINHA,
    PRJ.IDENTIFICACAO AS CHASSI,
    COMP.QTD          AS DURACAO,
    COMP.FEITO        AS STATUS
  FROM AD_COMPONENTECRONO COMP
    LEFT JOIN TAB_APO APO
      ON APO.SEQ = COMP.SEQ AND APO.CODUSU = COMP.CODUSU AND APO.CODPRODSP = COMP.CODPRODSP
    LEFT JOIN AD_CRONOGRAMA CRO ON CRO.SEQ      = COMP.SEQ
    LEFT JOIN TCSPRJ PRJ        ON PRJ.CODPROJ  = CRO.CODPROJ
  WHERE COMP.RETRABALHO IS NULL
    AND CRO.ANO * 100 + CRO.MES >= ${ano * 100 + mes}
),
DETAVANCO AS (
  SELECT
    COD_SEQUENCIAL, CHASSI, LINHA, MES, ANO,
    SUM(CASE WHEN STATUS = 'S' THEN DURACAO ELSE 0 END) AS DURACAO_CONCLU,
    SUM(DURACAO) AS DURACAO_TOT
  FROM TAB_ATIVIDADES
  GROUP BY COD_SEQUENCIAL, CHASSI, LINHA, MES, ANO
)
SELECT
  COD_SEQUENCIAL,
  CHASSI,
  LINHA,
  MES,
  ANO,
  CASE WHEN SUM(DURACAO_TOT) > 0
    THEN ROUND(SUM(DURACAO_CONCLU) / SUM(DURACAO_TOT) * 100, 2)
    ELSE 0
  END AS PCT_CONCLU
FROM DETAVANCO
GROUP BY COD_SEQUENCIAL, CHASSI, LINHA, MES, ANO
ORDER BY LINHA, CHASSI
`.trim();
}

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
  WHERE PON.DTPONTO BETWEEN ${_oracleData(ini)} AND ${_oracleData(fim)}
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

function mapAtiv(r: unknown): RawAtivRow {
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

function mapPonto(r: unknown): RawPontoRow {
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

function agregarOpe(ativos: RawAtivRow[], pontos: RawPontoRow[]): AggRow[] {
  const grupos = [
    { label: 'Geral',    fn: (_: string) => true },
    { label: 'Galpão 1', fn: (l: string) => LINHAS_MAIORES.has(l) },
    { label: 'Galpão 2', fn: (l: string) => LINHAS_GALP2.has(l)   },
    { label: 'Galpão 3', fn: (l: string) => LINHAS_GALP3.has(l)   },
  ];
  return grupos.map(({ label, fn }) => ({
    label,
    horas:    ativos.filter(r => fn(r.linha)).reduce((s, r) => s + r.horas,      0),
    horasReg: pontos.filter(r => fn(r.linha)).reduce((s, r) => s + r.horasPonto, 0),
    qtdAtiv:  ativos.filter(r => fn(r.linha)).reduce((s, r) => s + r.qtdAtiv,    0),
    qtdPonto: pontos.filter(r => fn(r.linha)).reduce((s, r) => s + r.qtdPonto,   0),
  }));
}

export type ProducaoKpis = {
  ope: number | null;
  aderencia: number | null;
};

export async function getProducaoKpis(mes: number, ano: number): Promise<ProducaoKpis> {
  const now = new Date();
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const isMesAtual = mes === now.getMonth() + 1 && ano === now.getFullYear();
  const ultimoDia  = isMesAtual ? now.getDate() : diasNoMes;

  const periodoIni = `01/${String(mes).padStart(2, '0')}/${ano}`;
  const periodoFim = `${String(ultimoDia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;

  const opeQueries = [LINHAS_MAIORES_ARR, LINHAS_MENORES_ARR].flatMap(linhas =>
    SETORES_SQL.flatMap(setor => [
      obterReg(buildSqlAtividades(periodoIni, periodoFim, linhas, setor)),
      obterReg(buildSqlPonto(periodoIni, periodoFim, linhas, setor)),
    ])
  );

  const [opeResults, barcosRows] = await Promise.all([
    Promise.all(opeQueries),
    obterReg<Record<string, unknown>>(buildSqlBarcosEntregues(mes, ano)),
  ]);

  const ativos: RawAtivRow[]  = [];
  const pontos: RawPontoRow[] = [];
  for (let i = 0; i < opeResults.length; i += 2) {
    opeResults[i].forEach(r => ativos.push(mapAtiv(r)));
    opeResults[i + 1].forEach(r => pontos.push(mapPonto(r)));
  }

  const agg      = agregarOpe(ativos, pontos);
  const geralRow = agg.find(o => o.label === 'Geral');
  const ope      = geralRow && geralRow.horasReg > 0
    ? geralRow.horas / geralRow.horasReg * 100
    : null;

  const barcosDoMes  = barcosRows.filter(r =>
    Number(r['MES'] ?? r['mes'] ?? 0) === mes &&
    Number(r['ANO'] ?? r['ano'] ?? 0) === ano,
  );
  const totBarcos    = barcosDoMes.length;
  const totEntregues = barcosDoMes.reduce(
    (s, r) => s + Number(r['PCT_CONCLU'] ?? r['pct_conclu'] ?? 0) / 100,
    0,
  );
  const aderencia = totBarcos > 0 ? totEntregues / totBarcos * 100 : null;

  return { ope, aderencia };
}
