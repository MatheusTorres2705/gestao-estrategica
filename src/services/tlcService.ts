import { obterReg } from '@/lib/api';

function pad2(n: number) { return String(n).padStart(2, '0'); }
function ultimoDia(mes: number, ano: number) {
  return String(new Date(ano, mes, 0).getDate()).padStart(2, '0');
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type TransformacaoRow = {
  referencia?: string;  // 'MM/YYYY' — presente em queries de período
  chassi: string;
  descricao: string;   // linha (ex: 'NX 260-290')
  codproj: number;
  duracao: number;     // horas
  vlrTarifa: number;
  custoTransfor: number;
};

// Agrupado por chassi (soma de custoTransfor quando há múltiplas tarifas)
export type TransformacaoChassi = {
  chassi: string;
  descricao: string;
  custoTransfor: number;
};

// ── SQL ───────────────────────────────────────────────────────────────────────

function buildTransformacaoSql(mes: number, ano: number): string {
  const ini = `01/${pad2(mes)}/${ano}`;
  const fim = `${ultimoDia(mes, ano)}/${pad2(mes)}/${ano}`;

  return `
WITH TAB_APO AS (
  SELECT APO.*
  FROM AD_CRONOGRAMA CRO
    LEFT JOIN AD_DETALCRONOGRAMA DET ON DET.SEQ = CRO.SEQ
    LEFT JOIN AD_APOAVANCO APO ON (APO.SEQ = DET.SEQ AND APO.CODUSU = DET.CODUSU)
    LEFT JOIN TGFPRO PRO ON APO.CODPRODSP = PRO.CODPROD
    INNER JOIN TCSPRJ PRJ ON (PRJ.CODPROJ = CRO.CODPROJ)
    INNER JOIN TSIUSU USU ON (USU.CODUSU = APO.CODUSU)
  WHERE APO.DATA BETWEEN '${ini}' AND '${fim}'
    AND SUBSTR(PRJ.IDENTIFICACAO, 1, 5) IN (
      'NX260','NX270','NX280','NX290','NX310',
      'NX340','NX350','NX360','NX370','NX410','NX440','NX500','NX620','NX62'
    )
)
SELECT
  TO_CHAR(DATA_EXECUCAO, 'MM/YYYY') AS REFERENCIA,
  DESCRICAO,
  CODPROJ,
  CHASSI,
  SUM(DURACAO) / 60 AS DURACAO,
  VLRTARIFA,
  (SUM(DURACAO) / 60) * VLRTARIFA AS CUSTO_TRANSFOR
FROM (
  SELECT
    COMP.SEQ AS COD_SEQUENCIAL,
    SUBSTR(PRJ.IDENTIFICACAO, 1, 5) AS LINHA,
    PRJ.IDENTIFICACAO AS CHASSI,
    PRJ.CODPROJ,
    COMP.CODUSU AS COD_SETOR,
    USU.NOMEUSU AS SETOR,
    COMP.CODPRODSP AS COD_ATIVIDADE,
    PRO.DESCRPROD AS ATIVIDADE,
    COMP.QTD AS DURACAO,
    COMP.FEITO AS STATUS,
    APO.DATA AS DATA_EXECUCAO,
    TAR.VLRTARIFA,
    LIN.DESCRICAO
  FROM AD_COMPONENTECRONO COMP
    LEFT JOIN TAB_APO APO
      ON APO.SEQ = COMP.SEQ AND APO.CODUSU = COMP.CODUSU AND APO.CODPRODSP = COMP.CODPRODSP
    LEFT JOIN TGFPRO PRO ON PRO.CODPROD = COMP.CODPRODSP
    LEFT JOIN TSIUSU USU ON USU.CODUSU = COMP.CODUSU
    LEFT JOIN AD_CRONOGRAMA CRO ON CRO.SEQ = COMP.SEQ
    LEFT JOIN TCSPRJ PRJ ON PRJ.CODPROJ = CRO.CODPROJ
    JOIN TCSPRJ PAI ON PAI.CODPROJ = PRJ.CODPROJPAI
    JOIN TGFGRU G ON G.CODGRUPOPROD = PAI.AD_CODGRUPOPROD
    JOIN AD_LINHAPROD LIN ON LIN.CODLINHAPROD = G.AD_CODLINHAPROD
    LEFT JOIN AD_TARIFAHORARIA TAR
      ON TAR.ANO = EXTRACT(YEAR FROM APO.DATA)
     AND TAR.MES = EXTRACT(MONTH FROM APO.DATA)
  WHERE COMP.RETRABALHO IS NULL AND APO.DATA IS NOT NULL
)
GROUP BY CHASSI, VLRTARIFA, TO_CHAR(DATA_EXECUCAO, 'MM/YYYY'), DESCRICAO, CODPROJ
`.trim();
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapRow(r: unknown): TransformacaoRow {
  if (Array.isArray(r)) {
    // ordem: REFERENCIA(0), DESCRICAO(1), CODPROJ(2), CHASSI(3), DURACAO(4), VLRTARIFA(5), CUSTO_TRANSFOR(6)
    return {
      referencia:    String(r[0] ?? ''),
      chassi:        String(r[3] ?? ''),
      descricao:     String(r[1] ?? ''),
      codproj:       Number(r[2] ?? 0),
      duracao:       Number(r[4] ?? 0),
      vlrTarifa:     Number(r[5] ?? 0),
      custoTransfor: Number(r[6] ?? 0),
    };
  }
  const o = r as Record<string, unknown>;
  return {
    referencia:    String(o['REFERENCIA']   ?? o['referencia']   ?? ''),
    chassi:        String(o['CHASSI']        ?? o['chassi']        ?? ''),
    descricao:     String(o['DESCRICAO']     ?? o['descricao']     ?? ''),
    codproj:       Number(o['CODPROJ']       ?? o['codproj']       ?? 0),
    duracao:       Number(o['DURACAO']       ?? o['duracao']       ?? 0),
    vlrTarifa:     Number(o['VLRTARIFA']     ?? o['vlrtarifa']     ?? 0),
    custoTransfor: Number(o['CUSTO_TRANSFOR']?? o['custo_transfor']?? 0),
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function getTransformacaoPorMes(mes: number, ano: number): Promise<TransformacaoRow[]> {
  const rows = await obterReg<unknown>(buildTransformacaoSql(mes, ano));
  return rows.map(mapRow);
}

/** Agrega por chassi (soma quando há múltiplas tarifas para o mesmo chassi) */
export function agruparPorChassi(rows: TransformacaoRow[]): TransformacaoChassi[] {
  const map = new Map<string, TransformacaoChassi>();
  for (const r of rows) {
    const existing = map.get(r.chassi);
    if (existing) {
      existing.custoTransfor += r.custoTransfor;
    } else {
      map.set(r.chassi, { chassi: r.chassi, descricao: r.descricao, custoTransfor: r.custoTransfor });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.chassi.localeCompare(b.chassi));
}

export type TransformacaoLinha = {
  descricao: string;
  custoTransfor: number;
};

/** Agrega por linha de produto (LIN.DESCRICAO) */
export function agruparPorLinha(rows: TransformacaoRow[]): TransformacaoLinha[] {
  const map = new Map<string, TransformacaoLinha>();
  for (const r of rows) {
    const key = r.descricao || 'Sem linha';
    const existing = map.get(key);
    if (existing) {
      existing.custoTransfor += r.custoTransfor;
    } else {
      map.set(key, { descricao: key, custoTransfor: r.custoTransfor });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.descricao.localeCompare(b.descricao));
}

// ── Material Direto ───────────────────────────────────────────────────────────

export type MaterialDiretoRow = {
  descricao: string;   // LIN.DESCRICAO
  chassi: string;
  custoMateriais: number;
};

function buildMaterialDiretoSql(mes: number, ano: number): string {
  const ini = `01/${pad2(mes)}/${ano}`;
  const fim = `${ultimoDia(mes, ano)}/${pad2(mes)}/${ano}`;

  return `
SELECT
  DESCRICAO,
  CHASSI,
  SUM(VLR) AS CUSTO_MATERIAIS
FROM (
  SELECT
    LIN.DESCRICAO,
    CAB.IDIPROC,
    PRJ.CODPROJ,
    PRJ.IDENTIFICACAO AS CHASSI,
    ITE.CODPROD,
    ITE.VLRUNIT,
    SNK_GET_CUSTO('MEDIOCOMICMS', 1, ITE.CODPROD, ITE.CODLOCALORIG, ' ', CAB.DTNEG) * ITE.QTDNEG AS VLR
  FROM TGFCAB CAB
    JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
    JOIN TPRIPROC PROC ON PROC.IDIPROC = CAB.IDIPROC
    JOIN TCSPRJ PRJ ON PRJ.CODPROJ = PROC.AD_CODPROJ
    JOIN TCSPRJ PAI ON PAI.CODPROJ = PRJ.CODPROJPAI
    JOIN TGFGRU G ON G.CODGRUPOPROD = PAI.AD_CODGRUPOPROD
    JOIN AD_LINHAPROD LIN ON LIN.CODLINHAPROD = G.AD_CODLINHAPROD
    JOIN TPRIPA IP ON IP.IDIPROC = CAB.IDIPROC
    JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
  WHERE CAB.TIPMOV = 'F'
    AND CAB.DTNEG >= '${ini}'
    AND CAB.DTNEG <= '${fim}'
    AND PRO.USOPROD <> '3'
    AND ITE.USOPROD = 'M'
)
GROUP BY DESCRICAO, CHASSI
`.trim();
}

function mapMaterialRow(r: unknown): MaterialDiretoRow {
  if (Array.isArray(r)) {
    // ordem: DESCRICAO(0), CHASSI(1), CUSTO_MATERIAIS(2)
    return {
      descricao:      String(r[0] ?? ''),
      chassi:         String(r[1] ?? ''),
      custoMateriais: Number(r[2] ?? 0),
    };
  }
  const o = r as Record<string, unknown>;
  return {
    descricao:      String(o['DESCRICAO']      ?? o['descricao']      ?? ''),
    chassi:         String(o['CHASSI']         ?? o['chassi']         ?? ''),
    custoMateriais: Number(o['CUSTO_MATERIAIS'] ?? o['custo_materiais'] ?? 0),
  };
}

export async function getMaterialDiretoPorMes(mes: number, ano: number): Promise<MaterialDiretoRow[]> {
  const rows = await obterReg<unknown>(buildMaterialDiretoSql(mes, ano));
  return rows.map(mapMaterialRow);
}

export type MaterialDiretoLinha = {
  descricao: string;
  custoMateriais: number;
};

/** Agrega material direto por linha de produto (LIN.DESCRICAO) */
export function agruparMaterialPorLinha(rows: MaterialDiretoRow[]): MaterialDiretoLinha[] {
  const map = new Map<string, MaterialDiretoLinha>();
  for (const r of rows) {
    const key = r.descricao || 'Sem linha';
    const existing = map.get(key);
    if (existing) {
      existing.custoMateriais += r.custoMateriais;
    } else {
      map.set(key, { descricao: key, custoMateriais: r.custoMateriais });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.descricao.localeCompare(b.descricao));
}

// ── Receita ───────────────────────────────────────────────────────────────────

export type ReceitaRow = {
  descricao: string;   // LIN.DESCRICAO
  codproj: number;
  chassi: string;
  idiproc: number;
  vlrReceita: number;
};

function buildReceitaSql(mes: number, ano: number): string {
  const ini = `01/${pad2(mes)}/${ano}`;
  const fim = `${ultimoDia(mes, ano)}/${pad2(mes)}/${ano}`;

  return `
SELECT
  OP.DESCRICAO,
  OP.CODPROJ,
  OP.CHASSI,
  OP.IDIPROC,
  CAB.VLRNOTA AS VLR_RECEITA
FROM TGFCAB CAB
JOIN (
  SELECT
    LIN.DESCRICAO,
    CAB.IDIPROC,
    PRJ.CODPROJ,
    PRJ.IDENTIFICACAO AS CHASSI
  FROM TGFCAB CAB
    JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
    JOIN TPRIPROC PROC ON PROC.IDIPROC = CAB.IDIPROC
    JOIN TCSPRJ PRJ ON PRJ.CODPROJ = PROC.AD_CODPROJ
    JOIN TCSPRJ PAI ON PAI.CODPROJ = PRJ.CODPROJPAI
    JOIN TGFGRU G ON G.CODGRUPOPROD = PAI.AD_CODGRUPOPROD
    JOIN AD_LINHAPROD LIN ON LIN.CODLINHAPROD = G.AD_CODLINHAPROD
    JOIN TPRIPA IP ON IP.IDIPROC = CAB.IDIPROC
    JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
  WHERE CAB.TIPMOV = 'F'
    AND CAB.DTNEG >= '${ini}'
    AND CAB.DTNEG <= '${fim}'
    AND PRO.USOPROD <> '3'
    AND ITE.USOPROD = 'V'
) OP ON CAB.CODPROJ = OP.CODPROJ
       AND CAB.TIPMOV = 'P'
       AND CAB.CODTIPOPER = 1000
`.trim();
}

function mapReceitaRow(r: unknown): ReceitaRow {
  if (Array.isArray(r)) {
    // ordem: DESCRICAO(0), CODPROJ(1), CHASSI(2), IDIPROC(3), VLR_RECEITA(4)
    return {
      descricao:  String(r[0] ?? ''),
      codproj:    Number(r[1] ?? 0),
      chassi:     String(r[2] ?? ''),
      idiproc:    Number(r[3] ?? 0),
      vlrReceita: Number(r[4] ?? 0),
    };
  }
  const o = r as Record<string, unknown>;
  return {
    descricao:  String(o['DESCRICAO']  ?? o['descricao']  ?? ''),
    codproj:    Number(o['CODPROJ']    ?? o['codproj']    ?? 0),
    chassi:     String(o['CHASSI']     ?? o['chassi']     ?? ''),
    idiproc:    Number(o['IDIPROC']    ?? o['idiproc']    ?? 0),
    vlrReceita: Number(o['VLR_RECEITA']?? o['vlr_receita']?? 0),
  };
}

export async function getReceitaPorMes(mes: number, ano: number): Promise<ReceitaRow[]> {
  const rows = await obterReg<unknown>(buildReceitaSql(mes, ano));
  return rows.map(mapReceitaRow);
}

export type ReceitaLinha = {
  descricao: string;
  vlrReceita: number;
};

/** Agrega receita por linha de produto (LIN.DESCRICAO) */
export function agruparReceitaPorLinha(rows: ReceitaRow[]): ReceitaLinha[] {
  const map = new Map<string, ReceitaLinha>();
  for (const r of rows) {
    const key = r.descricao || 'Sem linha';
    const existing = map.get(key);
    if (existing) {
      existing.vlrReceita += r.vlrReceita;
    } else {
      map.set(key, { descricao: key, vlrReceita: r.vlrReceita });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.descricao.localeCompare(b.descricao));
}

// ── Período (Ciclo Completo) ──────────────────────────────────────────────────

export type PeriodKey = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'S1' | 'S2' | 'ANO';

export const PERIOD_DEFS: Record<PeriodKey, { label: string; mesIni: number; mesFim: number }> = {
  Q1:  { label: 'Q1 (Jan–Mar)',  mesIni: 1,  mesFim: 3  },
  Q2:  { label: 'Q2 (Abr–Jun)', mesIni: 4,  mesFim: 6  },
  Q3:  { label: 'Q3 (Jul–Set)', mesIni: 7,  mesFim: 9  },
  Q4:  { label: 'Q4 (Out–Dez)', mesIni: 10, mesFim: 12 },
  S1:  { label: 'S1 (Jan–Jun)', mesIni: 1,  mesFim: 6  },
  S2:  { label: 'S2 (Jul–Dez)', mesIni: 7,  mesFim: 12 },
  ANO: { label: 'Ano completo', mesIni: 1,  mesFim: 12 },
};

export function periodToDateRange(key: PeriodKey, ano: number): { iniDate: string; fimDate: string } {
  const { mesIni, mesFim } = PERIOD_DEFS[key];
  return {
    iniDate: `01/${pad2(mesIni)}/${ano}`,
    fimDate: `${ultimoDia(mesFim, ano)}/${pad2(mesFim)}/${ano}`,
  };
}

export type GanttRowData = {
  chassi: string;
  descricao: string;
  activeMonths: number[];  // meses com custoTransfor > 0, ordenados
};

// SQL builders por período — mesma estrutura, apenas date range diferente

function buildTransformacaoPorPeriodoSql(iniDate: string, fimDate: string): string {
  return `
WITH TAB_APO AS (
  SELECT APO.*
  FROM AD_CRONOGRAMA CRO
    LEFT JOIN AD_DETALCRONOGRAMA DET ON DET.SEQ = CRO.SEQ
    LEFT JOIN AD_APOAVANCO APO ON (APO.SEQ = DET.SEQ AND APO.CODUSU = DET.CODUSU)
    LEFT JOIN TGFPRO PRO ON APO.CODPRODSP = PRO.CODPROD
    INNER JOIN TCSPRJ PRJ ON (PRJ.CODPROJ = CRO.CODPROJ)
    INNER JOIN TSIUSU USU ON (USU.CODUSU = APO.CODUSU)
  WHERE APO.DATA BETWEEN '${iniDate}' AND '${fimDate}'
    AND SUBSTR(PRJ.IDENTIFICACAO, 1, 5) IN (
      'NX260','NX270','NX280','NX290','NX310',
      'NX340','NX350','NX360','NX370','NX410','NX440','NX500','NX620','NX62'
    )
)
SELECT
  TO_CHAR(DATA_EXECUCAO, 'MM/YYYY') AS REFERENCIA,
  DESCRICAO,
  CODPROJ,
  CHASSI,
  SUM(DURACAO) / 60 AS DURACAO,
  VLRTARIFA,
  (SUM(DURACAO) / 60) * VLRTARIFA AS CUSTO_TRANSFOR
FROM (
  SELECT
    COMP.SEQ AS COD_SEQUENCIAL,
    SUBSTR(PRJ.IDENTIFICACAO, 1, 5) AS LINHA,
    PRJ.IDENTIFICACAO AS CHASSI,
    PRJ.CODPROJ,
    COMP.CODUSU AS COD_SETOR,
    USU.NOMEUSU AS SETOR,
    COMP.CODPRODSP AS COD_ATIVIDADE,
    PRO.DESCRPROD AS ATIVIDADE,
    COMP.QTD AS DURACAO,
    COMP.FEITO AS STATUS,
    APO.DATA AS DATA_EXECUCAO,
    TAR.VLRTARIFA,
    LIN.DESCRICAO
  FROM AD_COMPONENTECRONO COMP
    LEFT JOIN TAB_APO APO
      ON APO.SEQ = COMP.SEQ AND APO.CODUSU = COMP.CODUSU AND APO.CODPRODSP = COMP.CODPRODSP
    LEFT JOIN TGFPRO PRO ON PRO.CODPROD = COMP.CODPRODSP
    LEFT JOIN TSIUSU USU ON USU.CODUSU = COMP.CODUSU
    LEFT JOIN AD_CRONOGRAMA CRO ON CRO.SEQ = COMP.SEQ
    LEFT JOIN TCSPRJ PRJ ON PRJ.CODPROJ = CRO.CODPROJ
    JOIN TCSPRJ PAI ON PAI.CODPROJ = PRJ.CODPROJPAI
    JOIN TGFGRU G ON G.CODGRUPOPROD = PAI.AD_CODGRUPOPROD
    JOIN AD_LINHAPROD LIN ON LIN.CODLINHAPROD = G.AD_CODLINHAPROD
    LEFT JOIN AD_TARIFAHORARIA TAR
      ON TAR.ANO = EXTRACT(YEAR FROM APO.DATA)
     AND TAR.MES = EXTRACT(MONTH FROM APO.DATA)
  WHERE COMP.RETRABALHO IS NULL AND APO.DATA IS NOT NULL
)
GROUP BY CHASSI, VLRTARIFA, TO_CHAR(DATA_EXECUCAO, 'MM/YYYY'), DESCRICAO, CODPROJ
`.trim();
}

function buildMaterialDiretoPorPeriodoSql(iniDate: string, fimDate: string): string {
  return `
SELECT
  DESCRICAO,
  CHASSI,
  SUM(VLR) AS CUSTO_MATERIAIS
FROM (
  SELECT
    LIN.DESCRICAO,
    CAB.IDIPROC,
    PRJ.CODPROJ,
    PRJ.IDENTIFICACAO AS CHASSI,
    ITE.CODPROD,
    ITE.VLRUNIT,
    SNK_GET_CUSTO('MEDIOCOMICMS', 1, ITE.CODPROD, ITE.CODLOCALORIG, ' ', CAB.DTNEG) * ITE.QTDNEG AS VLR
  FROM TGFCAB CAB
    JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
    JOIN TPRIPROC PROC ON PROC.IDIPROC = CAB.IDIPROC
    JOIN TCSPRJ PRJ ON PRJ.CODPROJ = PROC.AD_CODPROJ
    JOIN TCSPRJ PAI ON PAI.CODPROJ = PRJ.CODPROJPAI
    JOIN TGFGRU G ON G.CODGRUPOPROD = PAI.AD_CODGRUPOPROD
    JOIN AD_LINHAPROD LIN ON LIN.CODLINHAPROD = G.AD_CODLINHAPROD
    JOIN TPRIPA IP ON IP.IDIPROC = CAB.IDIPROC
    JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
  WHERE CAB.TIPMOV = 'F'
    AND CAB.DTNEG >= '${iniDate}'
    AND CAB.DTNEG <= '${fimDate}'
    AND PRO.USOPROD <> '3'
    AND ITE.USOPROD = 'M'
)
GROUP BY DESCRICAO, CHASSI
`.trim();
}

function buildReceitaPorPeriodoSql(iniDate: string, fimDate: string): string {
  return `
SELECT
  OP.DESCRICAO,
  OP.CODPROJ,
  OP.CHASSI,
  OP.IDIPROC,
  CAB.VLRNOTA AS VLR_RECEITA
FROM TGFCAB CAB
JOIN (
  SELECT
    LIN.DESCRICAO,
    CAB.IDIPROC,
    PRJ.CODPROJ,
    PRJ.IDENTIFICACAO AS CHASSI
  FROM TGFCAB CAB
    JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
    JOIN TPRIPROC PROC ON PROC.IDIPROC = CAB.IDIPROC
    JOIN TCSPRJ PRJ ON PRJ.CODPROJ = PROC.AD_CODPROJ
    JOIN TCSPRJ PAI ON PAI.CODPROJ = PRJ.CODPROJPAI
    JOIN TGFGRU G ON G.CODGRUPOPROD = PAI.AD_CODGRUPOPROD
    JOIN AD_LINHAPROD LIN ON LIN.CODLINHAPROD = G.AD_CODLINHAPROD
    JOIN TPRIPA IP ON IP.IDIPROC = CAB.IDIPROC
    JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
  WHERE CAB.TIPMOV = 'F'
    AND CAB.DTNEG >= '${iniDate}'
    AND CAB.DTNEG <= '${fimDate}'
    AND PRO.USOPROD <> '3'
    AND ITE.USOPROD = 'V'
) OP ON CAB.CODPROJ = OP.CODPROJ
       AND CAB.TIPMOV = 'P'
       AND CAB.CODTIPOPER = 1000
`.trim();
}

export async function getTransformacaoPorPeriodo(iniDate: string, fimDate: string): Promise<TransformacaoRow[]> {
  const rows = await obterReg<unknown>(buildTransformacaoPorPeriodoSql(iniDate, fimDate));
  return rows.map(mapRow);
}

export async function getMaterialDiretoPorPeriodo(iniDate: string, fimDate: string): Promise<MaterialDiretoRow[]> {
  const rows = await obterReg<unknown>(buildMaterialDiretoPorPeriodoSql(iniDate, fimDate));
  return rows.map(mapMaterialRow);
}

export async function getReceitaPorPeriodo(iniDate: string, fimDate: string): Promise<ReceitaRow[]> {
  const rows = await obterReg<unknown>(buildReceitaPorPeriodoSql(iniDate, fimDate));
  return rows.map(mapReceitaRow);
}
